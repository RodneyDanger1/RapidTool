// ---------------------------------------------------------------------------
// Machine-checkable Definition-of-Done gate registry (T8) — dod.ts
//
// Every phase 0..12 carries exit criteria expressed as *deterministic,
// defensive probes* over plain Project fields (artifacts, phase records,
// memory kinds, scorecard verdict, competitors, openapi/adr text, lastTest).
// runGate() evaluates the phase's DoD and returns a stable FNV-1a evidence
// hash over sorted "id:pass|fail" pairs so a recorded gate verdict can be
// re-verified later (PhaseRecord.gate.evidenceHash). readyFor() is the DoR
// side: prior phase sealed, phase not already complete, project not blocked.
// gateArtifact() renders a gate verdict as a normal "gate" artifact.
// recordGateInto() (E-02) is the shared pure gate-recorder (store.recordGate
// parity): stamps PhaseRecord.gate, swaps in the "gate" artifact and appends
// the gate.verdict log for a just-completed phase. DOD[6]'s additive
// p6-verified probe (E-07) is met only by a machine-promoted lastTest (label
// "tested" + evidenceHash) — p6-test stays the deterministic floor.
// oracleToCaseSeeds()/missingOracleCaseIds() (E-08) are the pure
// oracle-pinning seam consumed by the verify loop's case generation.
//
// Run: node --experimental-strip-types --test src/lib/gates.test.ts
// ---------------------------------------------------------------------------
import type { Artifact, HitlDecision, OracleTest, PhaseId, Project } from "./types.ts";
import { canonicalStem, fnv1a } from "./algorithms.ts";
import { evaluatePolicy, seatLabel, type PolicySeat } from "./policy.ts";
import {
  BRIEF_STOPWORDS,
  briefNounHits,
  briefTokens,
  buildPhase6Module,
  identifierHits,
} from "./sandbox.ts";

export type GateItem = { id: string; criterion: string; probe: (p: Project) => boolean };

// --- defensive probe helpers -------------------------------------------------

/**
 * P0-02 proxy (fixes/97 §1.3): the brief contains ≥1 token the LEX would ever
 * match — cheap approximation: a non-stopword token longer than 2 chars.
 */
function briefHasVocabulary(brief: string): boolean {
  return briefTokens(brief).some((t) => !BRIEF_STOPWORDS.has(t) && t.length > 2);
}

const hasArtifact = (p: Project, phase: number, kind: string): boolean =>
  (p.artifacts ?? []).some((a) => a.phase === phase && a.kind === kind);

/** 216 (T0.8 — actor-truthful HITL probe): the old `phaseComplete` asked only
 *  whether the phase RECORD was complete, so four criteria asserting "HITL
 *  approved" were satisfied by ANY machine approval — the claim was about a
 *  person, the test was about a record (the self-referential-criteria bug).
 *  This reads the DECISION LEDGER and returns who actually approved, so a
 *  criterion can assert exactly what was verified. Strictly stronger than the
 *  record check: a completed phase with no ledger row now fails.
 *
 *  216o (T-107.3 · P0-02/P0-06 · W5-L3): the read now re-asks the ONE policy
 *  seam (`evaluatePolicy`, src/lib/policy.ts) whether the row records a
 *  decision the seam permits for `hitl.approve` on this gate — instead of
 *  trusting the `decidedBy` string alone. See `policyConsistentApproval`. */

/** The recorded out-of-band evidence marker `headless.approve` writes into the
 *  ledger note ONLY after the token pair verified (the 216 TA-2 note contract). */
const HUMAN_SEAT_EVIDENCE_RE = /RT_HUMAN_SEAT_TOKEN verified/;

/** The human branch's stand-in the probe presents to the seam: the probe holds
 *  no out-of-band secret (it is gone by verify time), so it presents the ROW's
 *  recorded token-path marker as both sides of the check. The call therefore
 *  verifies "the row records a verified-human decision" — stated plainly, not
 *  overclaimed as re-running the token match (impossible offline). */
const RECORDED_TOKEN_PATH = "recorded:RT_HUMAN_SEAT_TOKEN-verified";

/** What a ledger row's seat tag claims (the 216 TA-2 `[seat <label>]` note). */
type RowSeatClaim =
  | { kind: "seat"; seat: PolicySeat }
  | { kind: "tagged-unknown" }
  | { kind: "untagged" };

/**
 * Classify a ledger row's recorded seat. A tag that does not name a registered
 * PolicySeat matching the row's `decidedBy` is `tagged-unknown` — an
 * edited/forged record fails closed. A row with no tag is `untagged` (legacy
 * direct `approveHitl` records: engine autopilot steps, testing fixtures,
 * store-level approvals).
 */
const classifyRowSeat = (row: HitlDecision): RowSeatClaim => {
  const tag = /\[seat ([^\]]+)\]/.exec(row.note ?? "")?.[1];
  if (tag === undefined) return { kind: "untagged" };
  if (tag === "human-cli-i-am-human" && row.decidedBy === "human") {
    return { kind: "seat", seat: { decidedBy: "human", seat: "human-cli-i-am-human" } };
  }
  if ((tag === "harness" || tag === "autopilot") && row.decidedBy === "autopilot") {
    return { kind: "seat", seat: { decidedBy: "autopilot", seat: tag } };
  }
  return { kind: "tagged-unknown" };
};

/**
 * 216o (T-107.3 · P0-02 · W6-L2): when a row records `decidedVia` provenance
 * (minted by the headless approval path), the field must AGREE with what the
 * row itself claims — the seat tag's label, this gate (resource), a registered
 * action, and the token path. The seam only ever allows a human-seat allow
 * through the verified out-of-band token path, so a human-labeled row can
 * never carry `tokenPath: false` (and an autopilot row can never carry
 * `tokenPath: true`); any contradiction fails closed. A legacy row WITHOUT the
 * field (pre-216o payloads, direct `approveHitl` writers) keeps the pre-W6
 * tolerance — the check adds teeth, it never invents provenance for old rows.
 */
const provenanceConsistent = (row: HitlDecision, seat: PolicySeat, phase: number): boolean => {
  const via = row.decidedVia;
  if (via === undefined) return true; // legacy row: nothing recorded to cross-check
  if (via.resource !== `gate:P${phase}`) return false;
  if (via.action !== "hitl.approve" && via.action !== "hitl.force") return false;
  if (via.label !== seatLabel(seat)) return false;
  if (typeof via.reason !== "string" || !via.reason.includes(" — ")) return false;
  return via.tokenPath === (seat.decidedBy === "human");
};

/**
 * 216o (T-107.3 · P0-02/P0-06): does this ledger row record a decision the
 * policy seam permits? A TAGGED row must be policy-consistent or it fails
 * closed: an autopilot tag passes the seam's Rule A; a human tag must carry
 * the recorded out-of-band evidence too — without it the seam denies
 * (`human-seat-unverified`, fallback `human-seat-token`) and the criterion
 * fails. A tagged row whose optional `decidedVia` provenance contradicts the
 * tag (W6-L2: wrong gate, unregistered action, forged label, impossible token
 * path) also fails closed via `provenanceConsistent`. An UNTAGGED row keeps
 * the 216 T0.8 rule (a recorded actor exists); that tolerance is deliberate:
 * the writers that could forge a human row (the headless seam, the CLI verb)
 * are both routed through the seam, and pre-216o payloads carry no tag to test.
 */
const policyConsistentApproval = (row: HitlDecision, phase: number): boolean => {
  const claim = classifyRowSeat(row);
  if (claim.kind === "tagged-unknown") return false;
  if (claim.kind === "seat" && !provenanceConsistent(row, claim.seat, phase)) return false;
  if (claim.kind === "untagged") return true;
  const recorded = HUMAN_SEAT_EVIDENCE_RE.test(row.note ?? "");
  const verdict = evaluatePolicy("hitl.approve", `gate:P${phase}`, {
    actor: claim.seat,
    humanSeatToken: recorded ? RECORDED_TOKEN_PATH : undefined,
    expectedHumanSeatToken: recorded ? RECORDED_TOKEN_PATH : undefined,
  });
  return verdict.decision === "allow";
};

const approvalActor = (p: Project, phase: number): "human" | "autopilot" | null => {
  const row = (p.decisions ?? []).find(
    (d) => d.phase === phase && d.decision === "approve",
  );
  if (!row) return null;
  return policyConsistentApproval(row, phase) ? row.decidedBy : null;
};
const approved = (p: Project, phase: number): boolean => approvalActor(p, phase) !== null;

const kindsPresent = (p: Project, kinds: string[]): boolean => {
  const present: Set<string> = new Set((p.memory ?? []).map((m) => m.kind));
  return kinds.every((k) => present.has(k));
};

// --- p6-arch: capability → real-tree-file mapping (fixes/144 M2 lane B4) ----
// The multi-file generation tree (Project.generatedTree — keyed synthesis
// only) must meet the same brief-faithfulness bar the single-module probes
// enforce, at FILE granularity: every capability the expanded spec demands
// (each typeSignature export; falling back to spec requirements, then —
// keyless — to the lattice jobs' required noun vocabulary) maps to ≥1 tree
// file whose CODE contains the capability's stemmed identifier (literals and
// comments masked), and no tree file is a byte-identical copy of a
// deterministic template stub (the engine floor buildPhase6Module writes for
// THIS project). archTrace() is the pure, deterministic trace both the p6-arch
// probe and the engine's P6 reqTrace stamp consume. An absent tree is the
// single-module (legacy path): the probe passes vacuously so keyless /
// deterministic runs — and refused keyed synthesis that landed the floor —
// are never broken by the tree probe.

export type ArchTraceRow = {
  /** Capability label — a typeSignature line, spec requirement, or lattice job. */
  capability: string;
  /** Tree file paths whose code carries ≥1 of the capability's identifiers. */
  files: string[];
};

export type ArchTrace = {
  /** true when generatedTree is a non-empty array (tree mode). */
  present: boolean;
  /**
   * true when the tree probe did not run (absent tree = legacy single-module).
   * Skip is NOT product-complete: `runGate` p6-arch still passes so the keyless
   * floor is not hard-broken, but `archProductComplete` is false.
   */
  skipped: boolean;
  /** Capability → files mapping (tree mode; empty in legacy mode). */
  rows: ArchTraceRow[];
  /** Capability labels with NO tree file carrying their identifiers. */
  missing: string[];
  /** Tree file paths that are template stubs, TODO(E-15) stubs, or
   *  reexport-only jobs whose targets point OUTSIDE the tree. The machine-
   *  assembled entry barrel whose reexport targets all resolve in-tree is
   *  exempt (fixes/255 §P2). */
  stubFiles: string[];
  /** Human note: "tree (<n> files)" or "single-module (legacy path)". */
  note: string;
};

/**
 * Canonical leftover-job / floor markers. A file carrying these is not a
 * product implementation — never invent flip/record/show/publish bodies to
 * "fix" this; the honest bar is to refuse product-complete on stubs.
 */
export function isStubSource(source: string): boolean {
  if (typeof source !== "string") return true;
  if (hasTodoMarker(source)) return true;
  if (isReexportOnlySource(source)) return true;
  return false;
}

/** The two explicit leftover-job / floor declarations (E-15 markers). Their
 *  own predicate because the §P2 barrel exemption must never rescue a file
 *  that declares itself unfinished. */
function hasTodoMarker(source: string): boolean {
  const s = typeof source === "string" ? source : "";
  return s.includes("TODO(E-15)") || /throw\s+new\s+Error\s*\(\s*(['"`])TODO\b/i.test(s);
}

/** Comment-stripped, whitespace-collapsed code text — pure; the shared strip
 *  both reexport classifiers below read so their logic can never drift. */
function stripCommentsAndCollapse(source: string): string {
  return String(source ?? "")
    .replace(/\/\*[\s\S]*?\*\//g, "\n")
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when, after comment strip, every statement is `export … from` / `import … from`. */
export function isReexportOnlySource(source: string): boolean {
  const code = stripCommentsAndCollapse(source);
  if (!code) return false;
  const stmts = code
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  if (stmts.length === 0) return false;
  const reexport =
    /^(export\s+(\*|\{[\s\S]*?\})\s+from\s+['"][^'"]+['"]|import\s+.+\s+from\s+['"][^'"]+['"])$/;
  return stmts.every((st) => reexport.test(st));
}

/** Quoted module specifiers of every `from "…"` clause (comment-stripped).
 *  Pure; feeds the in-tree-target barrel exemption in archTrace(). */
function reexportSpecifiers(source: string): string[] {
  const code = stripCommentsAndCollapse(source);
  const out: string[] = [];
  const re = /\bfrom\s+(['"])([^'"]+)\1/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) out.push(m[2]);
  return out;
}

/** POSIX-normalize a relative specifier against the importing file's dir. */
function resolveTreeSpecifier(spec: string, fromPath: string): string {
  const from = String(fromPath ?? "").replace(/\\/g, "/");
  const dir = from.includes("/") ? from.slice(0, from.lastIndexOf("/")) : "";
  const stack = dir ? dir.split("/").filter(Boolean) : [];
  for (const part of String(spec ?? "").replace(/\\/g, "/").split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.join("/");
}

/** fixes/255 §P2: true when a reexport-only file's EVERY specifier resolves to
 *  another file of the SAME tree (node-style candidates: exact, extensionless
 *  → .ts/.tsx//index.ts, .js/.jsx → .ts/.tsx). A leftover job pointing outside
 *  the tree (the E-15 `./host.ts` fixture) returns false and stays a stub. */
function reexportTargetsAllInTree(
  file: { path: string; source: string },
  paths: ReadonlySet<string>,
): boolean {
  const specs = reexportSpecifiers(file.source);
  if (specs.length === 0) return false;
  return specs.every((s) => {
    if (!s.startsWith("./") && !s.startsWith("../")) return false;
    const base = resolveTreeSpecifier(s, file.path);
    const candidates = [base];
    if (!/\.[A-Za-z0-9]+$/.test(base)) {
      candidates.push(`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`);
    } else if (base.endsWith(".js")) {
      candidates.push(`${base.slice(0, -3)}.ts`, `${base.slice(0, -3)}.tsx`);
    } else if (base.endsWith(".jsx")) {
      candidates.push(`${base.slice(0, -4)}.tsx`);
    }
    return candidates.some((c) => paths.has(c));
  });
}

/** Product-complete tree: present, not skipped, no missing caps, no stub files. */
export function archProductComplete(t: ArchTrace): boolean {
  return (
    t.present === true &&
    t.skipped !== true &&
    t.missing.length === 0 &&
    t.stubFiles.length === 0
  );
}

/** Primary declared name a typeSignature line demands: `export function
 * createBoard(…)` → createBoard; `export type Order = …` → Order; bare
 * `createOrder(items: …)` → createOrder. Null when nothing parses (the line
 * then demands no identifier and is skipped, never a false fail). */
function signaturePrimaryName(sig: string): string | null {
  const s = typeof sig === "string" ? sig.trim() : "";
  if (!s) return null;
  const fn = s.match(/\b(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)/);
  if (fn) return fn[1];
  const decl = s.match(/\b(?:type|interface|class|enum|const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)/);
  if (decl) return decl[1];
  const bare = s.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/);
  if (bare) return bare[1];
  return null;
}

/** Prose capability text → demanded identifier tokens (stopword-filtered,
 * identifier-valid). Hyphenated lattice labels ("dispatch-board") tokenize
 * into their word parts exactly like briefTokens does for real briefs. */
function proseCapabilityTokens(text: string): string[] {
  return (typeof text === "string" ? text : "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(
      (t) => t.length > 1 && !BRIEF_STOPWORDS.has(t) && /^[a-z_$][a-z0-9_$]*$/.test(t),
    );
}

/** One capability the tree must implement. Each demanded identifier is an
 * equivalence GROUP of lowercase match forms (raw + canonicalStem) so prose
 * "scheduling" agrees with a `schedule()` implementation while a snake_case
 * signature name still matches its camelCase file. A group is met when ≥1 of
 * its forms appears in ≥1 tree file's code (identifierHits semantics). */
type ArchCapability = { label: string; groups: string[][] };

/** The expanded spec's capability list (typeSignatures first, requirements as
 * the keyed fallback, lattice jobs as the keyless fallback). */
function archCapabilities(p: Project): ArchCapability[] {
  const spec = p.implementationSpec;
  const out: ArchCapability[] = [];
  if (spec && Array.isArray(spec.typeSignatures) && spec.typeSignatures.length > 0) {
    for (const sig of spec.typeSignatures) {
      const s = String(sig).trim();
      const name = signaturePrimaryName(s);
      if (!name) continue; // unparseable signature — no identifier demand
      out.push({ label: s, groups: [[name.toLowerCase(), canonicalStem(name)]] });
    }
  } else if (spec && Array.isArray(spec.requirements) && spec.requirements.length > 0) {
    for (const req of spec.requirements) {
      const r = String(req).trim();
      if (!r) continue;
      const tokens = [...new Set(proseCapabilityTokens(r))];
      out.push({ label: r, groups: tokens.map((t) => [t, canonicalStem(t)]) });
    }
  } else {
    // keyless: the lattice jobs' required noun capabilities
    for (const job of p.lattice?.jobs ?? []) {
      const j = String(job).trim();
      if (!j) continue;
      const tokens = [...new Set(proseCapabilityTokens(j))];
      out.push({ label: j, groups: tokens.map((t) => [t, canonicalStem(t)]) });
    }
  }
  return out;
}

/** Deterministic template-stub texts a tree file must never equal byte-for-byte:
 * the engine floor buildPhase6Module could have produced for THIS project
 * (variant 0/1 × with/without the recorded P6 rejection note). */
function templateStubTexts(p: Project): Set<string> {
  const jobs = (p.lattice?.jobs ?? ["core"]).slice(0, 5);
  const rec = (p.phases ?? []).find((r) => r.id === 6);
  const note = rec?.rejectionNote ?? null;
  const out = new Set<string>();
  for (const variant of [0, 1]) {
    for (const rejectionNote of [note, null]) {
      out.add(buildPhase6Module({ name: p.name, jobs, rejectionNote, variant }));
    }
  }
  return out;
}

/** Machine-checkable p6-arch trace over Project.generatedTree (pure, deterministic). */
export function archTrace(p: Project): ArchTrace {
  const tree = Array.isArray(p.generatedTree) ? p.generatedTree : [];
  if (tree.length === 0) {
    // Deterministic/keyless runs and refused keyed synthesis that landed the
    // single-module floor carry no tree — p6-arch still PASSES so the keyless
    // floor is not hard-broken, but this is a SKIP, not product-complete.
    return {
      present: false,
      skipped: true,
      rows: [],
      missing: [],
      stubFiles: [],
      note: "single-module (legacy path)",
    };
  }
  const files = tree.filter((f) => f && typeof f.source === "string" && f.source.length > 0);
  const stubs = templateStubTexts(p);
  const paths = new Set(files.map((f) => f.path));
  const stubFiles = files
    .filter((f) => {
      if (stubs.has(f.source)) return true; // deterministic template floor
      // fixes/255 §P2: the reexport-only arm is target-resolution-aware — a
      // pure reexport file is a stub ONLY when ≥1 of its targets does not
      // resolve to another file of this tree. The engine's own assembled entry
      // barrel (`src/generated.ts` = `export * from "./generated/chunk-0.ts"`)
      // is machine assembly, not a leftover job; a leftover pointing outside
      // the tree (E-15 `./host.ts`) stays a stub. An explicit TODO(E-15) /
      // throw-TODO marker still dominates — the exemption can never rescue a
      // file that declares itself unfinished (the barrel never carries one).
      if (isReexportOnlySource(f.source) && !hasTodoMarker(f.source)) {
        return !reexportTargetsAllInTree(f, paths);
      }
      return isStubSource(f.source);
    })
    .map((f) => f.path);
  const rows: ArchTraceRow[] = [];
  const missing: string[] = [];
  for (const cap of archCapabilities(p)) {
    if (cap.groups.length === 0) continue; // no identifier demand — nothing to map
    const forms = [...new Set(cap.groups.flat())];
    const fileHits = files
      .map((f) => ({ path: f.path, found: identifierHits(forms, f.source) }))
      .filter((h) => h.found.length > 0);
    const found = new Set<string>(fileHits.flatMap((h) => h.found));
    const allMet = cap.groups.every((g) => g.some((form) => found.has(form)));
    if (allMet && fileHits.length > 0) {
      rows.push({ capability: cap.label, files: fileHits.map((h) => h.path) });
    } else {
      missing.push(cap.label);
    }
  }
  return {
    present: true,
    skipped: false,
    rows,
    missing,
    stubFiles,
    note: `tree (${files.length} file${files.length === 1 ? "" : "s"})`,
  };
}

// --- DoD registry -------------------------------------------------------------

/**
 * Exit criteria per phase 0..12. Probes read ONLY project content — never
 * timestamps, ids or randomness — so runGate() is deterministic and its
 * evidence hash is reproducible across equivalent project states.
 */
export const DOD: Record<PhaseId, GateItem[]> = {
  0: [
    {
      id: "p0-scorecard",
      criterion: "Feasibility scorecard present with 5 axes",
      probe: (p) => p.scorecard != null && (p.scorecard.axes?.length ?? 0) >= 5,
    },
    {
      id: "p0-verdict",
      criterion:
        "P0 verdict resolved to proceed (proceed | proceed-with-guards) — a reframe verdict is unmet",
      probe: (p) =>
        p.scorecard?.verdict === "proceed" || p.scorecard?.verdict === "proceed-with-guards",
    },
    {
      id: "p0-lattice",
      criterion: "Intent lattice primed with at least one job",
      probe: (p) => p.lattice != null && (p.lattice.jobs?.length ?? 0) >= 1,
    },
    {
      // P0-02 (fixes/97, 87 H7): records whether a vocabulary-bearing brief
      // sailed on the fallback lattice (the 87/88 wrong-product signature).
      // The reframe HITL's approve-with-note is the human override; this
      // probe only makes the fallback visible in the recorded gate.
      id: "p0-brief-grounded",
      criterion:
        "Non-empty brief produced job/entity vocabulary (lattice.vague must be false when the brief has ≥1 vocabulary-bearing token)",
      probe: (p) => !(p.lattice?.vague === true && briefHasVocabulary(p.brief)),
    },
  ],
  1: [
    {
      id: "p1-graph",
      criterion: "Dispatcher topology graph artifact exists for P1",
      probe: (p) => hasArtifact(p, 1, "graph"),
    },
  ],
  2: [
    {
      id: "p2-memory",
      criterion: "Memory contains all three kinds (episodic, semantic, procedural)",
      probe: (p) => kindsPresent(p, ["episodic", "semantic", "procedural"]),
    },
    {
      id: "p2-scorecard",
      criterion: "Feasibility scorecard carried into P2",
      probe: (p) => p.scorecard != null,
    },
  ],
  3: [
    {
      id: "p3-mcp",
      criterion: "MCP/A2A contract artifact exists for P3",
      probe: (p) => hasArtifact(p, 3, "mcp"),
    },
  ],
  4: [
    {
      id: "p4-security",
      criterion: "Security isolation artifact exists for P4",
      probe: (p) => hasArtifact(p, 4, "security"),
    },
    {
      // 216o (T-107.3 · P0-02/P0-06 · W5-L3): the four "decision ledger records
      // the approver" criteria (p4-approved / p5-complete / p8-complete /
      // p9-approved) re-ask the ONE policy seam via `approved()` →
      // `policyConsistentApproval` — a tagged row must be a policy-allow for
      // hitl.approve on its gate, or the criterion fails (see the helper above).
      // W6-L2: a row that carries `decidedVia` provenance must additionally
      // AGREE with its tag (label, gate, action, token path) or it fails closed.
      id: "p4-approved",
      criterion: "P4 approved — decision ledger records the approver (human or autopilot)",
      probe: (p) => approved(p, 4),
    },
  ],
  5: [
    {
      id: "p5-validation",
      criterion: "Validation artifact exists for P5",
      probe: (p) => hasArtifact(p, 5, "validation"),
    },
    {
      id: "p5-complete",
      criterion: "P5 approved — decision ledger records the approver (human or autopilot)",
      probe: (p) => approved(p, 5),
    },
  ],
  6: [
    {
      // M-11 (audit-bugs/05): the executor behind lastTest is runGenerated's
      // ENGINE-TEMPLATE runner, so the agent-facing wording says "self-test" —
      // "sandbox" is reserved for real runSandboxed worker executions. The
      // probe reads the REAL lastTest verdict record (the field only the
      // engine runner writes) and never infers a pass from artifact presence;
      // gates stay advisory (header above), and this is the deterministic
      // floor a later "tested" verdict builds on (04_verification_design §6).
      id: "p6-test",
      criterion: "Last template self-test run passed",
      probe: (p) =>
        p.lastTest != null &&
        p.lastTest.ok === true &&
        typeof p.lastTest.detail === "string" &&
        p.lastTest.detail.length > 0,
    },
    {
      id: "p6-source",
      criterion: "Generated source is non-empty",
      probe: (p) => typeof p.generatedSource === "string" && p.generatedSource.length > 0,
    },
    {
      id: "p6-artifact",
      criterion: "Generated code artifact exists for P6",
      probe: (p) => hasArtifact(p, 6, "code"),
    },
    {
      // E-07 (04_verification_design §8.1–8.4): machine-verification promotion
      // probe — additive over p6-test, which remains the deterministic floor.
      // Met only when a real verify loop promoted a "tested" verdict carrying
      // an evidence hash (engine.runP6Real promotion branch / applyVerifyOutcome
      // mint the label; a "self-test"/"real-run" label never satisfies it).
      // lastTest.label/evidenceHash are read through a defensive shape so this
      // probe compiles and runs whether or not the types.ts fields have landed
      // yet (E-07 #1 — old payloads simply stay unmet, never throw).
      id: "p6-verified",
      criterion:
        'Machine verification promoted a tested verdict (lastTest.label === "tested" with evidenceHash)',
      probe: (p) => {
        const lt = p.lastTest as {
          ok?: boolean;
          detail?: string;
          label?: string;
          evidenceHash?: string;
        } | null;
        return (
          lt !== null &&
          lt !== undefined &&
          lt.label === "tested" &&
          typeof lt.evidenceHash === "string" &&
          lt.evidenceHash.length > 0
        );
      },
    },
    {
      // P0-01 Part A (fixes/97, DF-01/DF-04): the absence of brief-derived
      // code becomes a recorded, visible FAIL instead of a silent toy pass.
      // Keyless policy: the deterministic placeholder fails this probe BY
      // CONSTRUCTION (its identifiers never carry brief vocabulary); a keyed
      // liveP6Synthesis module passes it. Vocabulary-free briefs pass
      // vacuously (nothing to conform). Additive AFTER p6-verified so
      // evidence-hash ordering of existing pairs is untouched.
      id: "p6-brief-fit",
      criterion:
        "Brief-conformance: required brief nouns appear as identifiers in the generated source (single-module, or the union of the tree files in tree mode)",
      probe: (p) => {
        const { required } = briefNounHits(p.brief);
        if (required.length === 0) return true;
        // fixes/255 §P1: in tree mode generatedSource is the ESM BARREL
        // (`export * from …` only) — measured 0 brief hits on a fully
        // synthesized tree. Read the union of the barrel + every generatedTree
        // file: the SAME artifact the engine's pre-acceptance fit check
        // measures (codegen assembleTreeEntry). The union can only ADD hits,
        // so no verdict flips PASS→FAIL.
        const tree = Array.isArray(p.generatedTree) ? p.generatedTree : [];
        const source =
          tree.length > 0
            ? [
                p.generatedSource ?? "",
                ...tree.map((f) => (f && typeof f.source === "string" ? f.source : "")),
              ].join("\n")
            : p.generatedSource ?? "";
        const hits = identifierHits(required, source);
        return hits.length >= Math.max(1, Math.ceil(required.length * 0.5));
      },
    },
    {
      // fixes/144 (M2, lane B4): multi-file TREE architecture probe — additive
      // after p6-brief-fit. Keyed multi-file synthesis must map EVERY
      // expanded-spec capability to ≥1 generatedTree file whose code carries
      // the capability's stemmed identifier, and no tree file may be
      // byte-identical to a deterministic template stub (the engine floor).
      // An absent tree — deterministic/keyless runs, or a refused keyed
      // synthesis that landed the single-module floor — still PASSES this
      // probe so the keyless floor is not hard-broken. That pass is a SKIP,
      // not product-complete: archProductComplete() is false, and TODO(E-15)
      // bodies join template stubs in stubFiles (fail). W23 (fixes/255 §P2):
      // a reexport-only file fails ONLY when ≥1 of its targets points outside
      // the tree — the machine-assembled entry barrel reexporting in-tree
      // files is exempt; an explicit TODO(E-15) / throw-TODO marker always
      // stands as a stub.
      // archTrace() carries the reqTrace detail the engine's P6 stamp surfaces.
      id: "p6-arch",
      criterion:
        "Tree architecture: every expanded-spec capability maps to a real generatedTree file carrying its stemmed identifier; no tree file is a template stub or an out-of-tree reexport-only leftover (an assembly barrel whose targets all resolve in-tree is exempt; absent tree = single-module legacy path)",
      probe: (p) => {
        const t = archTrace(p);
        return t.missing.length === 0 && t.stubFiles.length === 0;
      },
    },
  ],
  7: [
    {
      id: "p7-competitors",
      criterion: "At least two competitors mapped",
      probe: (p) => (p.competitors?.length ?? 0) >= 2,
    },
    {
      id: "p7-research",
      criterion: "Live research corpus exists for P7 (≥1 fetched finding)",
      // audit-39 1.2: the documented liveUnavailable waiver is now REAL — a
      // P7 whose live pass was attempted but the backend was unavailable
      // (no key / network failure, engine.liveLayer stamps meta.liveUnavailable)
      // must not hard-block an enforceDod project forever.
      probe: (p) => (p.research?.length ?? 0) > 0 || p.meta?.liveUnavailable === true,
    },
  ],
  8: [
    {
      id: "p8-ui",
      criterion: "UI artifact exists for P8",
      probe: (p) => hasArtifact(p, 8, "ui"),
    },
    {
      id: "p8-complete",
      criterion: "P8 approved — decision ledger records the approver (human or autopilot)",
      probe: (p) => approved(p, 8),
    },
  ],
  9: [
    {
      id: "p9-cicd",
      criterion: "CI/CD artifact exists for P9",
      probe: (p) => hasArtifact(p, 9, "cicd"),
    },
    {
      id: "p9-complete",
      criterion: "P9 approved — decision ledger records the approver (human or autopilot)",
      probe: (p) => approved(p, 9),
    },
  ],
  10: [
    {
      id: "p10-edge",
      criterion: "Edge inference artifact exists for P10",
      probe: (p) => hasArtifact(p, 10, "edge"),
    },
  ],
  11: [
    {
      id: "p11-tools",
      criterion: "Live tool artifact exists for P11",
      probe: (p) => hasArtifact(p, 11, "tools"),
    },
  ],
  12: [
    {
      id: "p12-openapi",
      criterion: "OpenAPI spec declares 3.1.0",
      // DM-1: accept both YAML (`openapi: 3.1.0`) and JSON (`"openapi": "3.1.0"`)
      // forms so an imported/hand-authored JSON OpenAPI document can pass the gate.
      probe: (p) =>
        typeof p.openapi === "string" &&
        (p.openapi.includes("openapi: 3.1.0") ||
          p.openapi.includes('"openapi": "3.1.0"') ||
          p.openapi.includes('"openapi":"3.1.0"')),
    },
    {
      id: "p12-adr",
      criterion: "ADR trail exists (contains an ADR- marker)",
      probe: (p) => typeof p.adr === "string" && p.adr.includes("ADR-"),
    },
  ],
};

function evaluate(project: Project, items: GateItem[]): { ok: boolean }[] {
  return items.map((item) => {
    let ok = false;
    try {
      ok = item.probe(project) === true;
    } catch {
      ok = false; // defensive: a throwing probe is an unmet criterion, never a crash
    }
    return { ok };
  });
}

/**
 * Machine-checkable DoD gate for one phase. evidenceHash = FNV-1a over the
 * sorted "id:pass|fail" pairs of every probe, so the same content always
 * yields the same hash and any content change flips it.
 */
export function runGate(
  project: Project,
  phase: number,
): { pass: boolean; unmet: GateItem[]; evidenceHash: string } {
  const items = DOD[phase as PhaseId];
  // A22: an unregistered phase must fail loudly — never a vacuous pass with a
  // constant "empty evidence" hash.
  if (!items) {
    return {
      pass: false,
      unmet: [
        {
          id: `unregistered-${phase}`,
          criterion: `No DoD criteria registered for phase ${phase}`,
          probe: () => false,
        },
      ],
      evidenceHash: String(fnv1a(`unregistered:${phase}`)),
    };
  }
  const results = evaluate(project, items);
  const unmet = items.filter((_, i) => !results[i].ok);
  const evidence = items
    .map((item, i) => `${item.id}:${results[i].ok ? "pass" : "fail"}`)
    .sort()
    .join("|");
  return { pass: unmet.length === 0, unmet, evidenceHash: String(fnv1a(evidence)) };
}

/**
 * Definition-of-Readiness for a phase: prior phase sealed (vacuous at P0),
 * the phase itself not already complete, and the project not blocked.
 */
export function readyFor(
  project: Project,
  phase: number,
): { ready: boolean; blockers: GateItem[] } {
  const checks: GateItem[] = [
    {
      id: "dor-prior",
      criterion: `Phase ${phase - 1} complete (vacuous at P0)`,
      probe: (p) =>
        phase === 0 || (p.phases ?? []).some((r) => r.id === phase - 1 && r.status === "complete"),
    },
    {
      id: "dor-open",
      criterion: `Phase ${phase} not already complete`,
      probe: (p) => !(p.phases ?? []).some((r) => r.id === phase && r.status === "complete"),
    },
    {
      id: "dor-unblocked",
      criterion: "Project not blocked",
      probe: (p) => p.status !== "blocked",
    },
  ];
  const results = evaluate(project, checks);
  const blockers = checks.filter((_, i) => !results[i].ok);
  return { ready: blockers.length === 0, blockers };
}

/** Render a gate verdict as a standard artifact (kind "gate", per ArtifactKind). */
export function gateArtifact(
  phase: number,
  r: { pass: boolean; unmet: string[]; evidenceHash: string },
): Artifact {
  const title = `DoD gate — P${phase}`;
  const body = [
    `# ${title}`,
    ``,
    `**Result: ${r.pass ? "PASS" : "FAIL"}**`,
    ``,
    ...(r.unmet.length > 0
      ? [`Unmet criteria:`, ...r.unmet.map((u) => `- ${u}`)]
      : [`All criteria met for phase ${phase}.`]),
    ``,
    `Evidence hash: ${r.evidenceHash}`,
  ].join("\n");
  return {
    id: `gate-p${phase}-${r.evidenceHash.slice(0, 8)}`,
    phase: phase as PhaseId,
    kind: "gate",
    title,
    body,
    language: "markdown",
  };
}

/**
 * E-02: record a machine-checkable DoD verdict for a just-completed phase —
 * the shared PURE gate-recorder (store.recordGate parity). Semantics mirror
 * store.recordGate (store.ts:83-124) byte-for-byte so the store can delegate
 * to this function and headless.finishPhase can record gates on CLI/headless
 * runs: no-op (same project reference) unless the phase record exists and is
 * "complete"; stamps PhaseRecord.gate {passed, unmet, evidenceHash,
 * checkedAt}, appends a capped `gate.verdict` log, and swaps in a fresh
 * kind-"gate" artifact (a prior gate artifact for the phase is replaced,
 * never duplicated).
 */
/** fixes/125 (W1 #2): the failed-gate census — every COMPLETE phase whose DoD
 *  gate recorded `passed:false`. A run must never present as cleanly complete
 *  while this list is non-empty. */
export function failedGates(project: Project): { phase: PhaseId; unmet: string[] }[] {
  const out: { phase: PhaseId; unmet: string[] }[] = [];
  for (const p of project.phases ?? []) {
    if (p.status !== "complete" || !p.gate || p.gate.passed !== false) continue;
    out.push({ phase: p.id as PhaseId, unmet: Array.isArray(p.gate.unmet) ? p.gate.unmet : [] });
  }
  return out;
}

/** fixes/125 (W1 #2): true when any complete phase sealed with a failed gate. */
export function sealedWithFailures(project: Project): boolean {
  return failedGates(project).length > 0;
}

export function recordGateInto(project: Project, phase: PhaseId): Project {
  // F2-84: read through optional arrays like every probe does — a minimal or
  // hand-built shape ({ } as Project, phases/logs/artifacts absent) must be a
  // clean no-op (same reference), never a TypeError mid-append.
  const rec = (project.phases ?? []).find((p) => p.id === phase);
  if (!rec || rec.status !== "complete") return project;
  const r = runGate(project, phase);
  const unmet = r.unmet.map((g) => g.criterion);
  const phases = (project.phases ?? []).map((p) =>
    p.id === phase
      ? {
          ...p,
          gate: {
            passed: r.pass,
            unmet,
            evidenceHash: r.evidenceHash,
            checkedAt: Date.now(),
          },
        }
      : p,
  );
  const artifact = gateArtifact(phase, {
    pass: r.pass,
    unmet,
    evidenceHash: r.evidenceHash,
  });
  return {
    ...project,
    phases,
    logs: [
      ...(project.logs ?? []),
      {
        ts: Date.now(),
        phase,
        level: r.pass ? ("info" as const) : ("warn" as const),
        event: "gate.verdict",
        detail: `${r.pass ? "PASS" : "FAIL"} · ${r.unmet.length} unmet · ${r.evidenceHash.slice(0, 8)}`,
      },
    ].slice(-200),
    artifacts: [
      ...(project.artifacts ?? []).filter((a) => !(a.kind === "gate" && a.phase === phase)),
      artifact,
    ],
  };
}

// --- P0-04 capability ledger (fixes/97) -------------------------------------
// Single source of truth for "what this build actually runs on" (93 DF-03/
// DF-04/DF-06). Consumed by engine artifact templates (B-18 declare-or-strike
// tails) so no artifact states an unimplemented capability as fact. Pure,
// zero-dep, deterministic. (97 specified a new src/lib/capabilities.ts; this
// lane owns no new src files, so the ledger lives here — a later lane may move
// it verbatim. See fixes/100 correction #2.)

export const CAPABILITIES = {
  runtime: {
    implemented: ["sync-template"],
    declared: ["worker-isolate", "node-bounded-runner"],
    claim:
      "Engine-template runner (bounded, engine-authored code only); server-side bounded runner; Worker isolate declared, not a product path (E-29).",
  },
  network: {
    implemented: ["tavily-research", "deepseek-llm"],
    declared: [],
    claim:
      "Outbound: DeepSeek API + research providers only. No MCP client, no Brave, no repo.fs, no sandbox.exec servers (P2-3 roadmap).",
  },
  memory: {
    implemented: ["project-memory-80-row", "knowledge-store-file"],
    declared: ["durable-checkpoints", "cross-encoder-rerank"],
    claim:
      "Persistence = browser localStorage + JSON project files. No durable checkpoint layer, no RRF/cross-encoder (FusionRank is lexical, deliberately).",
  },
  model: {
    implemented: ["deepseek-v4-flash", "deepseek-v4-pro"],
    declared: [],
    claim: "No grok-4.5, no Ollama, no failover routes. modelRoute honesty enforced (E-14).",
  },
  concurrency: {
    implemented: ["sequential-13-phase"],
    declared: ["parallel-fanout", "websocket-tool-streams"],
    claim:
      "Linear graph only (phases.ts canEnter). Parallel workflow + WebSocket progress frames do not exist.",
  },
  learning: {
    implemented: [],
    declared: ["self-learning-loop"],
    claim: "P5 self-learning title only — no loop behind it (90 §10); write-back is M-08/G-25 roadmap.",
  },
} as const;

export type CapabilityArea = keyof typeof CAPABILITIES;

/** "- <area>: IMPLEMENTED <a, b> | DECLARED <c> — <claim>" line for artifact bodies. */
export function capabilityLine(area: CapabilityArea): string {
  const c = CAPABILITIES[area];
  const impl = c.implemented.length > 0 ? c.implemented.join(", ") : "none";
  const decl = c.declared.length > 0 ? c.declared.join(", ") : "none";
  return `- ${area}: IMPLEMENTED ${impl} | DECLARED ${decl} — ${c.claim}`;
}

/** B-18 "declaration, not implementation" tail every capability-claiming artifact body ends with. */
export function b18Tail(): string {
  return `> Implementation today: ${CAPABILITIES.runtime.claim} — the policy above is a declaration (B-18 honesty), not an implemented runtime.`;
}

// --- E-08 oracle-pinning seam (pure core) -----------------------------------
// The deterministic A7 oracle rows (Project.oracle) anchor every machine
// verify run: generateCases must keep every seeded row as a case with its
// exact id. These two pure helpers are the seam the verify loop consumes —
// prepend oracleToCaseSeeds() to the generation prompt, then reject/retry
// whenever missingOracleCaseIds() is non-empty (no blind pass).

/** Render each A7 oracle row as a `# orc-<id> <name> — <given> ⇒ <expect>` seed line. */
export function oracleToCaseSeeds(oracle: OracleTest[]): string {
  return oracle
    .filter((row) => typeof row.id === "string" && row.id.length > 0)
    .map((row) => `# ${row.id} ${row.name} — ${row.given} ⇒ ${row.expect}`)
    .join("\n");
}

/**
 * Seeded oracle ids (in oracle order) that a returned case list dropped.
 * Extra/unseeded returned ids are ignored — only pinned rows matter.
 */
export function missingOracleCaseIds(returnedIds: string[], oracle: OracleTest[]): string[] {
  const have = new Set(returnedIds);
  return oracle.map((row) => row.id).filter((id) => !have.has(id));
}

// --- P10 hard-DoD enforcement helpers (pure) --------------------------------
// Opt-in per-project (`Project.enforceDod`): a machine advance may not LEAVE a
// phase whose exit gate fails. The blocked-advance stamp is shared by the
// store auto-advance guard and the engine wild loop so both surfaces produce
// the SAME evidence: a fresh "Hard DoD block — P<n>" docs artifact (previous
// block artifact for the phase is replaced, never duplicated) + an append-only
// `dod.blocked` warn log listing the unmet criterion ids.

/** Short machine-readable block message (surfaced as the run error text). */
export function hardDodMessage(phase: number, r: { unmet: GateItem[] }): string {
  const ids = r.unmet.map((g) => g.id).join(", ");
  return `P${phase} DoD unmet — hard gate blocks advance${ids ? `: ${ids}` : ""}.`;
}

/** Stamp a hard-DoD block onto a project (pure). No-op-free: always stamps. */
export function hardDodBlockInto(
  project: Project,
  phase: number,
  r: { pass: boolean; unmet: GateItem[]; evidenceHash: string },
): Project {
  const unmet = r.unmet.map((g) => g.id);
  const body = [
    `# Hard DoD block — P${phase}`,
    ``,
    `**Advance denied**: P${phase} cannot be left while its exit criteria are unmet.`,
    ``,
    ...(unmet.length > 0
      ? [`Unmet criteria:`, ...r.unmet.map((g) => `- ${g.id}: ${g.criterion}`)]
      : [`No unmet criteria were reported (blocked on an empty/unknown gate).`]),
    ``,
    `Evidence hash: ${r.evidenceHash}`,
    ``,
    `> Fix the unmet evidence (re-run the phase, deepen research, run real`,
    `> verification) or turn Hard DoD off for this project to advance.`,
  ].join("\n");
  const artifact: Artifact = {
    id: `harddod-p${phase}-${r.evidenceHash.slice(0, 8)}`,
    phase: phase as PhaseId,
    kind: "docs",
    title: `Hard DoD block — P${phase}`,
    body,
    language: "markdown",
  };
  return {
    ...project,
    logs: [
      ...(project.logs ?? []),
      {
        ts: Date.now(),
        phase: phase as PhaseId,
        level: "warn" as const,
        event: "dod.blocked",
        detail: `P${phase} advance blocked — unmet: ${unmet.join(", ") || "n/a"}`,
      },
    ].slice(-200),
    artifacts: [
      ...(project.artifacts ?? []).filter(
        (a) => !(a.kind === "docs" && a.phase === phase && a.title.startsWith("Hard DoD block")),
      ),
      artifact,
    ],
  };
}
