/**
 * fixes/144 (M6, lane D4) — maker-score.ts: the PURE M1..M9 maker rubric.
 *
 * Scores a Project (+ driver-gathered evidence) against one corpus entry:
 * each criterion lands 0..1 on DETERMINISTIC inputs, and the total is the
 * mean of the nine. The module never touches fs/clock/randomness/network —
 * every impure observation (emitted-dir file existence, treeRun verdict,
 * driver stop flags) arrives as a precomputed parameter, exactly like the
 * TreeRunOutcome param pattern (compile-check.server.ts). Same inputs →
 * byte-identical card.
 *
 * Client-safe: only type-only imports plus pure helpers already in the client
 * bundle (sandbox.identifierHits/briefNounHits semantics — the SAME helpers
 * dod.ts probes use, so the rubric never drifts from the engine's own
 * p6-brief-fit/p6-verified semantics).
 *
 * Criteria (fixes/144_completion_plan.md mission M6 step 2):
 *   M1 substance  — generatedTree non-empty AND ≥1 file per expectedCapability
 *                   via identifier-stem hits; OR single-module generatedSource
 *                   that passes p6-brief-fit for library kinds.
 *   M2 runs       — precomputed treeRun outcome ok (compile-check treeRun).
 *   M3 iterates   — P6 journey outcome converged, or derived from the recorded
 *                   P6 gate (phases[6].gate.passed) + lastTest.
 *   M4 verifiable — the p6-verified probe semantics (dod.ts): lastTest.label
 *                   === "tested" AND ok === true AND a non-empty detail AND an
 *                   evidenceHash exists.
 *   M5 honest     — no red gate record, OR every red gate surfaced loudly
 *                   (sealedWithFailures flag / census log / warn gate.verdict);
 *                   0 when a red gate hides under a clean seal.
 *   M6 handover   — emitted dir exists with DEPLOY.md + a real oracle spec
 *                   (driver-gathered fs evidence).
 *   M7 learning   — a prior same-slug run that carried LEARNED substance
 *                   (M1 + M3 — model-produced code and its convergence; M2,
 *                   the deterministic tree-run, does not count): this run's
 *                   M1+M3 ≥ that prior's. 0 when there is no prior (a first
 *                   run has no lesson to reuse) or the prior carries no
 *                   learned substance — never a claim without data. A first
 *                   run therefore cannot score M7 by construction; the corpus
 *                   bar is per run kind (MakerBarWhen.firstRun excludes M7)
 *                   instead of being lowered.
 *   M8 bounded    — journey stayed within its configured budget (param).
 *   M9 on-time    — run stopped on time; a refused/abnormal stop is 1 only
 *                   when it parked LOUDLY with a code (never silent).
 */
import type { Project } from "./types.ts";
import type { TreeRunOutcome } from "./compile-check.server.ts";
import { canonicalStem } from "./algorithms.ts";
import { isStubSource } from "./dod.ts";
import { BRIEF_STOPWORDS, briefNounHits, identifierHits } from "./sandbox.ts";
// 338-4 (W52): the behavioral fixtures' DECISION state — the SAME pure
// derivation the doctor's factory bar reads, so the scorecard cannot say
// "accepted" while the doctor says no decision was recorded.
import { acceptanceDecisionQuestion, type FixtureAcceptanceState } from "./fixtures.ts";

// ---------------------------------------------------------------------------
// Evidence types (driver-gathered; the scorer only reads).
// ---------------------------------------------------------------------------

/** Corpus-expectation subset the rubric needs (the corpus file's frontmatter
 *  is mapped onto this by the driver — decoupled from D3's file schema). */
export type MakerCorpusExpectation = {
  kind?: string;
  brief?: string;
  expectedNouns?: string[];
  expectedCapabilities?: string[];
};

/** M2 evidence: the precomputed treeRun verdict over the emitted dir. */
export type MakerTreeRunEvidence = {
  ok: boolean;
  dir?: string;
  compileOk?: boolean;
  testsPass?: number;
  testsFail?: number;
  detail?: string;
  /** Honest skip — never treated as a product-complete run (skip ≠ green). */
  skipped?: boolean;
  /** Kind-entry smoke verdict when the driver lifted a TreeRunOutcome. */
  entryRun?: string;
  /** F4 (fixes/314_f4_outshine · MA §5 move 3 — the hashed verdict): the
   *  tree-run verdict's own FNV-1a hash (`treeVerdictHash`, set on every
   *  runnable verdict). Carried through so M2's green evidence can cite it
   *  and a reader can prove "same hash, same verdict" from the published
   *  scorecard. Integrity, not cryptography; absent on legacy evidence. */
  verdictHash?: string;
} | null;

/** M2 scores 1 only when assertions actually ran and passed — skip is not green. */
export function treeRunLooksSkipped(tr: NonNullable<MakerTreeRunEvidence>): boolean {
  if (tr.skipped === true) return true;
  const pass = typeof tr.testsPass === "number" ? tr.testsPass : 0;
  const fail = typeof tr.testsFail === "number" ? tr.testsFail : 0;
  if (pass <= 0 && fail <= 0) return true;
  if (tr.entryRun === "skip" && pass <= 0) return true;
  return false;
}

/** A4: lift TreeRunOutcome TAP into MakerTreeRunEvidence (oracle.spec only). */
export function treeRunToMakerEvidence(tr: TreeRunOutcome): MakerTreeRunEvidence {
  const rows = Array.isArray(tr.tests) ? tr.tests : [];
  const spec =
    rows.find((t) => t.file === "tests/oracle.spec.ts") ??
    rows.find((t) => t.file.endsWith("oracle.spec.ts"));
  const used = spec ? [spec] : rows;
  const testsPass = used.reduce((s, t) => s + (t.tests?.pass ?? 0), 0);
  const testsFail = used.reduce((s, t) => s + (t.tests?.fail ?? 0), 0);
  const entryRun = tr.run?.run;
  const specsAllSkip = used.length > 0 && used.every((t) => t.run === "skip");
  const skipped =
    specsAllSkip ||
    (testsPass === 0 && testsFail === 0) ||
    (entryRun === "skip" && testsPass === 0);
  return {
    ok: tr.ok === true && !skipped && testsPass > 0 && testsFail === 0,
    dir: tr.dir,
    compileOk: tr.compile?.ok,
    testsPass,
    testsFail,
    skipped,
    entryRun,
    // F4 (fixes/314_f4_outshine · MA §5 move 3): carry the tree-run verdict's
    // own hash through the lift — the eval's persisted M2 evidence reads it.
    verdictHash: typeof tr.verdictHash === "string" && tr.verdictHash.length > 0 ? tr.verdictHash : undefined,
    detail: spec && spec.run !== "pass" ? spec.detail : undefined,
  };
}

/** M3 evidence: the driveP6Journey envelope (keyless = honest no-op). */
export type MakerJourneyEvidence = {
  outcome: "converged" | "failed" | "keyless";
  cycles: number;
  budget: number;
  refusal?: string | null;
} | null;

/** M5 surfacing: the driver's RunResult.sealedWithFailures flag (the M4-1
 *  completion gate), when the project went through runUntilGate. */
export type MakerRunEvidence = {
  sealedWithFailures?: boolean;
} | null;

/** M6 evidence: fs facts gathered by the driver after emitProject. */
export type MakerHandoverEvidence = {
  emitted: boolean;
  deployMd: boolean;
  oracleSpec: boolean;
  /** Byte size of the oracle spec on disk — a "real" spec carries real
   *  assertions, i.e. non-trivial content (fixes/135; never a 0-byte stub). */
  oracleSpecBytes: number;
  emitError?: string | null;
} | null;

/** M8 evidence: journey budget bookkeeping. */
export type MakerBudgetEvidence = {
  used: number;
  budget: number;
  /** B3: measured DeepSeek tokens when the run actually called the API. */
  promptTokens?: number;
  completionTokens?: number;
} | null;

/** M9 evidence: how the run stopped. */
export type MakerStopEvidence = {
  onTime: boolean;
  refused: boolean;
  loud: boolean;
  code?: string | null;
} | null;

/** M7 evidence: the prior same-slug run's M1..M3 (driver reads its own
 *  persisted history; absent on the first run of a slug). M2 is retained for
 *  the evidence line only — 342-3 vB excludes it from the learned-substance
 *  test: it is the deterministic tree-run, not model-learned substance. */
export type MakerPriorEvidence = {
  m1: number;
  m2: number;
  m3: number;
} | null;

/**
 * A4: runner TAP for the behavioral spec (tests/oracle.spec.ts after A2).
 * When set, M1/M2 re-key on fixture pass/fail. Absent → legacy m1/m2
 * (no-fixture path stays byte-identical).
 *
 * 338-4 (W52): `acceptance` carries the fixtures' DECISION state
 * (`fixtures.fixtureAcceptanceState`). A behavioral pass is acceptance only
 * when the bar was human-approved: a pending / machine-decided / unattributed
 * bar scores 0 with the doctor's own sentence (`acceptanceDecisionQuestion`),
 * so the card and the factory bar can no longer tell two stories about one
 * run. Absent ⇒ the legacy A4 line, byte-identical.
 */
export type MakerBehavioralEvidence = {
  pass: number;
  fail: number;
  failedIds?: string[];
  acceptance?: FixtureAcceptanceState;
};

export type MakerScoreInput = {
  project: Project;
  corpus: MakerCorpusExpectation;
  treeRun?: MakerTreeRunEvidence;
  journey?: MakerJourneyEvidence;
  run?: MakerRunEvidence;
  handover?: MakerHandoverEvidence;
  budget?: MakerBudgetEvidence;
  stop?: MakerStopEvidence;
  prior?: MakerPriorEvidence;
  /**
   * A4: runner TAP for the behavioral spec (tests/oracle.spec.ts after A2).
   * When set, M1/M2 re-key on fixture pass/fail. Absent → legacy m1/m2
   * (no-fixture path stays byte-identical).
   */
  behavioral?: MakerBehavioralEvidence | null;
  /**
   * fixes/153 (scorer vacuity): true when the keyed run produced LLM content —
   * at least one synthesis attempt logged ok (P1's p6.synthesis.attempt).
   * false = EVERY synthesis call refused → the tree/run/mint evidence is the
   * deterministic floor, which is brief-noun-shaped BY CONSTRUCTION (the
   * floor's identifiers cannot discriminate it from real software). When
   * false, M1-M4 are forced 0 with the floor qualifier. undefined = legacy
   * runs without attempt logs → current behavior.
   */
  synthesisSucceeded?: boolean;
};

export type MakerCriterion = { score: 0 | 1; evidence: string };
export type MakerCriterionId = "M1" | "M2" | "M3" | "M4" | "M5" | "M6" | "M7" | "M8" | "M9";

export type MakerScoreCard = {
  criteria: Record<MakerCriterionId, MakerCriterion>;
  /** Sum of the nine criterion scores (integer, drift-free for M7 math). */
  total: number;
  /** Mean = total / 9 — the card's headline number. */
  mean: number;
};

/** fixes/154 (F1, scorer vacuity) — the evidence M1-M4 ALL share when the
 *  scored run never produced LLM content (input.synthesisSucceeded ===
 *  false). ONE string on purpose: the four forced-zero criteria read as a
 *  single honest statement, never as four plausible-looking per-criterion
 *  verdicts over floor artifacts. Exported so tests + the eval driver pin
 *  the exact wording. */
export const FLOOR_QUALIFIER_EVIDENCE =
  "all synthesis calls refused — tree/run/mint evidence is the deterministic floor (brief-noun-shaped by construction); no LLM-produced software exists";

/** 342-3 vB (hole 2, verifier B) — the KEYLESS floor qualifier, the sibling of
 *  the refusal floor above. A keyless run (no model configured; the driver's
 *  P6 journey is driveP6Journey's honest no-op, outcome "keyless") produces
 *  ONLY the deterministic scaffold, so its tree/run/mint evidence is
 *  floor-shaped for the same reason a fully-refused keyed run's is: it is
 *  brief-noun-shaped BY CONSTRUCTION and cannot be told apart from real
 *  software by identifier probes. Pre-vB the floor gate fired only on
 *  synthesisSucceeded === false, so keyless (undefined) cards were scored on
 *  floor greens and the "keyless floor fails" guarantee held only by the
 *  stored numbers. scoreMaker now forces M1-M4 to 0 for a keyless run, which
 *  pins its ceiling at M5,M6,M7,M8,M9 (5/9 warm, 4/8 first-run) — below every
 *  admissible corpus bar by construction. Exported so tests + the driver pin
 *  the exact wording. */
export const KEYLESS_FLOOR_QUALIFIER_EVIDENCE =
  "keyless run — no model configured; tree/run/mint evidence is the deterministic scaffold (brief-noun-shaped by construction); no model-produced software exists";

// ---------------------------------------------------------------------------
// Small pure helpers.
// ---------------------------------------------------------------------------

const LIBRARY_LIKE_KINDS = new Set([
  "library",
  "lib",
  "cli",
  "cli-tool",
  "tool",
  "sdk",
  "package",
  "agent",
  "console",
]);

function listOf(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((s) => s.trim());
}

function isLibraryKind(kind: string | undefined): boolean {
  if (typeof kind !== "string" || kind.trim() === "") return false;
  return LIBRARY_LIKE_KINDS.has(kind.trim().toLowerCase());
}

/** Identifier-search forms for one capability label: the whole label, its
 *  substantive tokens, and their canonical stems — identifierHits matches any
 *  form as a (case-insensitive) sub-identifier, mirroring dod's p6-arch reqTrace.
 *
 *  fixes/215c: tokens pass through BRIEF_STOPWORDS (the SAME stoplist the
 *  p6-brief-fit probe uses via briefNounHits). Without it a capability label's
 *  function words became match forms — `and` matched `handleStandardNotice`
 *  ("st-AND-ard"), `per` matched `property` — so ANY module with ordinary
 *  identifiers "covered" 5/7 real-estate capabilities. That is a fake-green
 *  leak in M1: the stoplist keeps a label's substance tokens only. */
function formsForCapability(capability: string): string[] {
  const raw = capability.toLowerCase();
  const tokens = raw
    .split(/[^a-z0-9_$]+/)
    .filter((t) => t.length > 1 && !BRIEF_STOPWORDS.has(t));
  const out = [raw];
  for (const t of tokens) {
    if (!out.includes(t)) out.push(t);
    const st = canonicalStem(t);
    if (st && st.length > 1 && !out.includes(st) && !BRIEF_STOPWORDS.has(st)) out.push(st);
  }
  return out;
}

/** The p6-brief-fit probe semantics (dod.ts's probe and codegen.server.ts's
 *  briefFitSatisfied), verbatim: ≥ 0.35 (min 1) of the brief's required nouns
 *  appear as identifiers in `source`. 322 X1 (P6-C) recalibrated the bar ½ →
 *  0.35 on all three sites; this function previously kept the stale half-bar
 *  while claiming parity. Vocabulary-free briefs pass vacuously. */
export function p6BriefFitPasses(brief: string, source: string): boolean {
  const required = briefNounHits(brief).required;
  if (required.length === 0) return true;
  const hits = identifierHits(required, typeof source === "string" ? source : "");
  return hits.length >= Math.max(1, Math.ceil(required.length * 0.35));
}

/** The real tree files of a project (path + source of every generatedTree
 *  entry that actually carries code). Exported so the run-eval driver can
 *  compute the SAME file set the rubric sees — the coverage report and the
 *  M1 verdict can never drift apart. */
export function treeFilesOf(project: Project): { path: string; source: string }[] {
  const tree = Array.isArray(project.generatedTree) ? project.generatedTree : [];
  const out: { path: string; source: string }[] = [];
  for (const f of tree) {
    if (!f || typeof f !== "object") continue;
    const path = (f as { path?: unknown }).path;
    const source = (f as { source?: unknown }).source;
    if (typeof path === "string" && typeof source === "string" && source.length > 0) {
      out.push({ path, source });
    }
  }
  return out;
}

/** M1 divergence-1 report: expectedCapability → tree file(s) that actually
 *  carry it (identifier-stem hit in code or path), plus the capabilities that
 *  found NO identifier in ANY tree file. PURE — the exact same probe
 *  m1Substance's tree branch runs, exported so run-eval can print + persist
 *  the capability-coverage report without ever drifting from the rubric. */
export type CapabilityCoverage = {
  /** capability label → paths of the tree files that carry a hit. */
  covered: Record<string, string[]>;
  /** capabilities with no identifier in any tree file (the M1=0 signal). */
  missing: string[];
};

export function capabilityCoverage(
  project: Project,
  capabilities: string[],
): CapabilityCoverage {
  // Stub/reexport files never cover a capability (skip ≠ substance).
  const files = treeFilesOf(project).filter((f) => !isStubSource(f.source));
  const covered: Record<string, string[]> = {};
  const missing: string[] = [];
  for (const cap of capabilities) {
    const forms = formsForCapability(cap);
    const hitFiles = files.filter((f) => {
      const srcHits = identifierHits(forms, f.source);
      if (srcHits.length > 0) return true;
      const p = f.path.toLowerCase();
      return forms.some((form) => p.includes(form));
    });
    if (hitFiles.length > 0) {
      covered[cap] = hitFiles.map((f) => f.path);
    } else {
      missing.push(cap);
    }
  }
  return { covered, missing };
}

function phaseRecord(project: Project, id: number) {
  return (project.phases ?? []).find((p) => p && p.id === id) ?? null;
}

function lastTestEvidence(
  project: Project,
): { label?: string; ok?: boolean; detail?: string; evidenceHash?: string } | null {
  const lt = project.lastTest as { label?: string; ok?: boolean; detail?: string; evidenceHash?: string } | null;
  if (!lt || typeof lt !== "object") return null;
  return lt;
}

// ---------------------------------------------------------------------------
// The nine criteria (each exported for boundary unit tests).
// ---------------------------------------------------------------------------

/** M1 substance. A4: when `behavioral` is supplied, score from TAP not stems. */
export function m1Substance(input: MakerScoreInput): MakerCriterion {
  if (input.behavioral) {
    const b = input.behavioral;
    // 338-4: the behavioral TAP ran against the acceptance bar — a pass is
    // acceptance only when that bar carries a human-approved decision. The
    // sentence is the doctor's own (acceptanceDecisionQuestion), so M1 and the
    // factory gap cannot disagree about the same run.
    const question = b.acceptance ? acceptanceDecisionQuestion(b.acceptance) : null;
    if (question !== null) return { score: 0, evidence: `no accepted bar — ${question}` };
    if (b.fail > 0) {
      const ids = Array.isArray(b.failedIds) && b.failedIds.length > 0 ? ` (${b.failedIds.join(", ")})` : "";
      return { score: 0, evidence: `behavioral fail ${b.fail}${ids}` };
    }
    if (b.pass > 0) {
      return { score: 1, evidence: `behavioral pass ${b.pass} fixture assertion(s)` };
    }
    return { score: 0, evidence: "no behavioral assertion ran" };
  }
  const { project, corpus } = input;
  const files = treeFilesOf(project);
  const caps = listOf(corpus.expectedCapabilities);
  const brief = typeof project.brief === "string" && project.brief.trim() ? project.brief : corpus.brief ?? "";
  const genSrc = typeof project.generatedSource === "string" ? project.generatedSource : "";

  if (files.length > 0) {
    const stubFiles = files.filter((f) => isStubSource(f.source));
    const realFiles = files.filter((f) => !isStubSource(f.source));
    // TREE MODE: leftover TODO(E-15) / reexport-only jobs are not substance.
    // All-stub trees cannot vacuous-pass and cannot be rescued by single-module.
    if (realFiles.length === 0) {
      return {
        score: 0,
        evidence: `tree ${files.length} file(s) are stubs/reexports — not product substance`,
      };
    }
    // TREE MODE: every expected capability must map to ≥1 real tree file
    // (identifier-stem hit in the file's code, or its path).
    if (caps.length === 0) {
      return {
        score: 1,
        evidence: `tree ${realFiles.length} real file(s)${stubFiles.length ? ` (${stubFiles.length} stub ignored)` : ""}, no expectedCapabilities demanded — substance vacuously satisfied`,
      };
    }
    const cov = capabilityCoverage(project, caps);
    const covered = Object.entries(cov.covered).map(([cap, paths]) => `${cap}->${paths.join(",")}`);
    if (cov.missing.length === 0) {
      return { score: 1, evidence: `tree ${realFiles.length} file(s); reqTrace: ${covered.join(" | ")}` };
    }
    return {
      score: 0,
      evidence: `tree ${realFiles.length} file(s) but capability mapping missing: ${cov.missing.join(", ")} (covered: ${covered.join(" | ") || "none"})`,
    };
  }

  // SINGLE-MODULE MODE (legacy/keyless-floor or refused-tree floor): a library
  // kind whose generatedSource passes the p6-brief-fit bar IS substance.
  if (isLibraryKind(corpus.kind) && genSrc.length > 0) {
    if (p6BriefFitPasses(brief, genSrc)) {
      return {
        score: 1,
        evidence: `single-module ${genSrc.length}b generatedSource passes p6-brief-fit (kind ${corpus.kind})`,
      };
    }
    return {
      score: 0,
      evidence: `single-module ${genSrc.length}b generatedSource fails p6-brief-fit (kind ${corpus.kind})`,
    };
  }
  return {
    score: 0,
    evidence: `no generatedTree (${files.length} file(s))${caps.length ? ` and ${caps.length} expectedCapabilit${caps.length === 1 ? "y" : "ies"} uncovered` : ""}; single-module pass needs a library kind${
      corpus.kind ? ` (got "${corpus.kind}")` : " (corpus kind absent)"
    }`,
  };
}

/** M2 runs — the precomputed treeRun verdict over the emitted dir. */
export function m2Runs(input: MakerScoreInput): MakerCriterion {
  const tr = input.treeRun;
  if (!tr) return { score: 0, evidence: "no treeRun verdict supplied" };
  // F4 (fixes/314_f4_outshine · MA §5 move 3 — hashed-verdict surfacing): when
  // the evidence carries the tree-run verdict's own hash, cite it on the green
  // line — the persisted scorecard can then prove "same hash, same verdict"
  // without re-running the tree. Absent hash ⇒ byte-identical legacy line.
  const hashBit =
    typeof tr.verdictHash === "string" && tr.verdictHash.length > 0
      ? ` · verdict ${tr.verdictHash.slice(0, 8)}`
      : "";
  if (input.behavioral) {
    const b = input.behavioral;
    // 338-4: same gate as M1 — a green treeRun over a behavioral bar no human
    // accepted is not a run of the accepted bar (one derivation, one sentence).
    const question = b.acceptance ? acceptanceDecisionQuestion(b.acceptance) : null;
    if (question !== null) return { score: 0, evidence: `treeRun ok but no accepted bar — ${question}` };
    if (b.fail > 0 || tr.ok !== true) {
      return {
        score: 0,
        evidence: `treeRun/behavioral not ok (pass ${b.pass} / fail ${b.fail}${tr.detail ? ` — ${tr.detail.slice(0, 160)}` : ""})`,
      };
    }
    if (b.pass > 0) {
      return { score: 1, evidence: `treeRun ok${hashBit}; behavioral ${b.pass} pass / 0 fail` };
    }
    return { score: 0, evidence: "no behavioral assertion ran" };
  }
  if (treeRunLooksSkipped(tr)) {
    return {
      score: 0,
      evidence: `treeRun skip is not green${tr.detail ? ` — ${tr.detail.slice(0, 220)}` : " (no assertions ran / skipped)"}`,
    };
  }
  if (tr.ok === true && (tr.testsPass ?? 0) > 0 && (tr.testsFail ?? 0) === 0) {
    const base = `treeRun ok (${tr.dir ?? "?"}${typeof tr.testsPass === "number" ? `; tests ${tr.testsPass} pass / ${tr.testsFail ?? 0} fail` : ""})`;
    // fixes/150 (G3, P2-3): when the scored run's P6 journey FAILED (the
    // results entry's journey marker; refusal included), a green treeRun is
    // the DETERMINISTIC FLOOR, never keyed LLM code — the evidence must say
    // so, or a future reader could read "green tree" as "keyed code green".
    const journeyFailed = input.journey?.outcome === "failed";
    return {
      score: 1,
      evidence: journeyFailed
        ? `${base}${hashBit} | journey: failed — treeRun green is the deterministic floor, not LLM code`
        : `${base}${hashBit}`,
    };
  }
  return {
    score: 0,
    evidence: `treeRun not ok${tr.detail ? ` — ${tr.detail.slice(0, 220)}` : ""}`,
  };
}

/** M3 iterates — the P6 journey converged, or the recorded P6 gate says so. */
export function m3Iterates(input: MakerScoreInput): MakerCriterion {
  const j = input.journey;
  if (j && j.outcome === "converged") {
    return { score: 1, evidence: `P6 journey converged after ${j.cycles}/${j.budget} cycle(s)` };
  }
  const rec6 = phaseRecord(input.project, 6);
  const gate = rec6 && rec6.gate && typeof rec6.gate === "object" ? rec6.gate : null;
  const lt = lastTestEvidence(input.project);
  if (gate && gate.passed === true && lt && lt.ok === true) {
    // 337-3: read the hash defensively (m2/m4 parity). A gate outside the typed
    // PhaseRecord.gate shape must yield a criterion, never a TypeError.
    const gateHash =
      typeof gate.evidenceHash === "string" && gate.evidenceHash.length > 0
        ? gate.evidenceHash.slice(0, 8)
        : "no hash";
    return {
      score: 1,
      evidence: `derived convergence: P6 gate passed (${gateHash}) + lastTest ok (${lt.label ?? "unlabeled"})`,
    };
  }
  const why =
    gate && gate.passed === false
      ? `P6 gate recorded FAIL (${(gate.unmet ?? []).join(", ") || "unmet"})`
      : gate && gate.passed === true
        ? "P6 gate passed but lastTest missing/failed"
        : j && j.outcome !== "converged"
          ? `journey outcome "${j.outcome}"${j.refusal ? ` — refusal: ${j.refusal.slice(0, 140)}` : ""}`
          : "no P6 gate record";
  return { score: 0, evidence: `no iteration convergence: ${why}` };
}

/** M4 machine-verifiable — EXACTLY dod.ts's p6-verified probe (dod.ts:693-703):
 *  lastTest.label === "tested" AND ok === true AND a non-empty detail AND a
 *  non-empty evidenceHash. W55 · 341-5: pre-fix this read only label + hash, so
 *  a hollow `{ok:false, label:"tested", evidenceHash:"h"}` record scored 1 while
 *  the P6 gate's own probe refused it — the comment claimed parity the bytes did
 *  not have. One record, one verdict. */
export function m4MachineVerifiable(input: MakerScoreInput): MakerCriterion {
  const lt = lastTestEvidence(input.project);
  const tested = lt !== null && lt.label === "tested";
  const ok = tested && lt!.ok === true;
  const detailed = ok && typeof lt!.detail === "string" && lt!.detail.length > 0;
  const hashed =
    detailed && typeof lt!.evidenceHash === "string" && (lt!.evidenceHash as string).length > 0;
  if (hashed) {
    return { score: 1, evidence: `lastTest "tested" + evidenceHash ${(lt!.evidenceHash as string).slice(0, 8)}` };
  }
  const why = !lt
    ? "absent"
    : !tested
      ? `label="${lt.label ?? "unlabeled"}"`
      : !ok
        ? 'label="tested" but ok≠true'
        : !detailed
          ? 'label="tested" + ok but NO detail'
          : 'label="tested" + ok + detail but NO evidenceHash';
  return { score: 0, evidence: `machine verification missing: lastTest ${why}` };
}

/** M5 honest — a red gate record must never hide under a clean-looking seal. */
export function m5Honest(input: MakerScoreInput): MakerCriterion {
  const { project } = input;
  const red = (project.phases ?? []).filter((p) => p && p.gate && p.gate.passed === false);
  if (red.length === 0) {
    return { score: 1, evidence: "no red DoD gate records — nothing to hide" };
  }
  const redIds = new Set(red.map((p) => p.id));
  const logs = project.logs ?? [];
  const census = logs.some(
    (l) =>
      l &&
      typeof l === "object" &&
      l.event === "run.complete.with.failed.gates" &&
      (l.level === "warn" || l.level === "error"),
  );
  const verdicts = logs.some(
    (l) =>
      l &&
      typeof l === "object" &&
      (l.level === "warn" || l.level === "error") &&
      l.event === "gate.verdict" &&
      l.phase != null &&
      redIds.has(l.phase),
  );
  const exhausted = logs.some(
    (l) =>
      l &&
      typeof l === "object" &&
      l.level === "error" &&
      l.event === "p6.journey.exhausted" &&
      l.phase === 6,
  );
  const flagged = input.run?.sealedWithFailures === true;
  if (flagged || census || verdicts || exhausted) {
    return {
      score: 1,
      evidence: `${red.length} red gate record(s) (P${[...redIds].join(", P")}) surfaced loudly: ${[
        flagged ? "sealedWithFailures flag" : "",
        census ? "census log" : "",
        verdicts ? "warn gate.verdict" : "",
        exhausted ? "p6.journey.exhausted" : "",
      ]
        .filter(Boolean)
        .join(" + ")}`,
    };
  }
  return {
    score: 0,
    evidence: `${red.length} red gate record(s) (P${[...redIds].join(", P")}) under a clean seal — no flag, no census log, no verdict log`,
  };
}

/** M6 handover — emitted dir with DEPLOY.md + a real oracle spec. */
export function m6Handover(input: MakerScoreInput): MakerCriterion {
  const h = input.handover;
  if (!h || h.emitted !== true) {
    return {
      score: 0,
      evidence: `no emitted handover dir${h?.emitError ? ` — ${h.emitError.slice(0, 160)}` : ""}`,
    };
  }
  const parts: string[] = [];
  if (h.deployMd) parts.push("DEPLOY.md");
  if (h.oracleSpec) parts.push(`oracle spec (${h.oracleSpecBytes}b)`);
  if (h.deployMd && h.oracleSpec && h.oracleSpecBytes >= 100) {
    return { score: 1, evidence: `handover dir emitted with ${parts.join(" + ")}` };
  }
  return {
    score: 0,
    evidence: `handover dir emitted but incomplete: ${parts.join(", ") || "no DEPLOY.md / oracle spec"}${
      h.oracleSpec && h.oracleSpecBytes < 100 ? " (oracle spec is a stub <100b)" : ""
    }`,
  };
}

/** M7 learning — a run demonstrates learning only against a prior same-slug
 *  run that itself carried LEARNED substance: this run's M1+M3 must not
 *  regress below that prior's M1+M3. Three honest zeros (342-3 / 342-3 vB):
 *   · no prior → 0: a first run has no lesson to reuse, so there is no
 *     learning claim to make. This is why the corpus bar is per run kind
 *     (a first run excludes M7) rather than lowered;
 *   · a prior whose own M1+M3 sum is 0 → 0: it carries no learned lesson, so
 *     matching it reuses nothing. Pre-342-3 `mineSum ≥ 0` was vacuously true
 *     against an all-zero prior; 342-3 vB widens this to the M2-only prior
 *     (m1 0 / m3 0, m2 1): M2 is the deterministic tree-run a keyless/floor
 *     run earns, not model-learned substance, so it cannot anchor a learning
 *     claim. 19 of history.json's 29 m7=1 rows had exactly that prior shape.
 *  The 0/1 boundary is "a real prior lesson was carried forward". */
export function m7Learning(input: MakerScoreInput): MakerCriterion {
  const prior = input.prior;
  if (!prior) {
    return { score: 0, evidence: "no prior same-slug run — no learning claim without data" };
  }
  const mineLearned = m1Substance(input).score + m3Iterates(input).score;
  const priorLearned = (prior.m1 ?? 0) + (prior.m3 ?? 0);
  if (priorLearned === 0) {
    return {
      score: 0,
      evidence: `prior same-slug run carries no learned substance (M1+M3 0; M2 ${prior.m2 ?? 0} is the deterministic tree-run) — nothing was learned to reuse`,
    };
  }
  if (mineLearned >= priorLearned) {
    return {
      score: 1,
      evidence: `M1+M3 ${mineLearned} ≥ prior learned substance ${priorLearned} (m1 ${prior.m1}/m3 ${prior.m3}; M2 ${prior.m2 ?? 0} is the deterministic tree-run, not learned substance)`,
    };
  }
  return {
    score: 0,
    evidence: `M1+M3 ${mineLearned} < prior learned substance ${priorLearned} — regression (m1 ${prior.m1}/m3 ${prior.m3})`,
  };
}

/** M8 bounded — the journey stayed inside its configured budget. */
export function m8Bounded(input: MakerScoreInput): MakerCriterion {
  const b = input.budget;
  if (!b) return { score: 0, evidence: "no budget evidence supplied" };
  const budget = Number(b.budget);
  const used = Number(b.used);
  if (!Number.isFinite(budget) || budget < 1) return { score: 0, evidence: `budget ${b.budget} not a positive bound` };
  if (Number.isFinite(used) && used <= budget) {
    const tokens =
      typeof b.promptTokens === "number" && typeof b.completionTokens === "number"
        ? ` · measured ${b.promptTokens}+${b.completionTokens} tokens`
        : " · cycle count only (no measured token usage)";
    return { score: 1, evidence: `journey used ${used}/${budget} cycle(s) — inside budget${tokens}` };
  }
  return { score: 0, evidence: `journey used ${used} > budget ${budget} — overran` };
}

/** M9 on-time / stop-loudly — a refused or abnormal stop parks with a code. */
export function m9OnTime(input: MakerScoreInput): MakerCriterion {
  const s = input.stop;
  if (!s) return { score: 0, evidence: "no stop evidence supplied" };
  if (s.onTime !== true) {
    return { score: 0, evidence: "run did not stop on time (cap/overrun without terminal state)" };
  }
  if (s.refused !== true) {
    return { score: 1, evidence: "run stopped on time, no refusal — nothing to shout" };
  }
  if (s.loud === true && typeof s.code === "string" && s.code.length > 0) {
    return { score: 1, evidence: `refused run parked LOUDLY with code ${s.code}` };
  }
  return { score: 0, evidence: "refused run stopped SILENTLY (no code / no loud record)" };
}

// ---------------------------------------------------------------------------
// The card.
// ---------------------------------------------------------------------------

export function scoreMaker(input: MakerScoreInput): MakerScoreCard {
  const criteria: Record<MakerCriterionId, MakerCriterion> = {
    M1: m1Substance(input),
    M2: m2Runs(input),
    M3: m3Iterates(input),
    M4: m4MachineVerifiable(input),
    M5: m5Honest(input),
    M6: m6Handover(input),
    M7: m7Learning(input),
    M8: m8Bounded(input),
    M9: m9OnTime(input),
  };
  // fixes/154 (F1) — the scorer-vacuity floor gate. When the driver recorded
  // synthesisSucceeded === false (a keyed run whose logs carry NO ok
  // p6.synthesis.attempt — every model call refused/timed out), every green
  // tree/run/mint datum on the project is the DETERMINISTIC FLOOR: it is
  // brief-noun-shaped BY CONSTRUCTION, so identifier probes can be fooled
  // into "substance"/"runs"/"iterates"/"verifiable" while no LLM-produced
  // software exists (the 9/9-on-a-refused-run artifact, fixes/145 correction
  // + fixes/153 finding). M1-M4 are forced 0 with ONE shared honest qualifier.
  // 342-3 vB (hole 2) extends the SAME card-level override to a KEYLESS run
  // (journey outcome "keyless" — driveP6Journey's honest no-op): no model was
  // configured, so no synthesis was ever attempted and the card is floor
  // greens for the same reason. Without this, synthesisSucceeded === undefined
  // skipped the gate and "the keyless floor fails" held only by the stored
  // numbers; with it, a keyless card is pinned to M5,M6,M7,M8,M9 (5/9 warm /
  // 4/8 first-run) — below every admissible bar by construction. A run with a
  // real keyed journey but no attempt logs is NOT keyless and stays legacy.
  // M5-M9 stay byte-identical — including M7, whose internal M1+M3 math runs
  // over the UNFORCED criteria (a floored run is not a learning regression;
  // the learning criteria judge the run's own motion, and its card is already
  // floored). The gate is a CARD-level override: the exported m1..m4 criteria
  // keep their own semantics for direct callers.
  // synthesisSucceeded true, or undefined with a non-keyless journey →
  // byte-identical legacy behavior.
  if (input.synthesisSucceeded === false) {
    const floor: MakerCriterion = { score: 0, evidence: FLOOR_QUALIFIER_EVIDENCE };
    criteria.M1 = { ...floor };
    criteria.M2 = { ...floor };
    criteria.M3 = { ...floor };
    criteria.M4 = { ...floor };
  } else if (input.journey?.outcome === "keyless") {
    const floor: MakerCriterion = { score: 0, evidence: KEYLESS_FLOOR_QUALIFIER_EVIDENCE };
    criteria.M1 = { ...floor };
    criteria.M2 = { ...floor };
    criteria.M3 = { ...floor };
    criteria.M4 = { ...floor };
  }
  const total = Object.values(criteria).reduce((acc, c) => acc + c.score, 0);
  return { criteria, total, mean: total / 9 };
}

// ---------------------------------------------------------------------------
// 342-3 (W56) — the corpus bar is per run kind.
//
// A first run has no prior same-slug run, so M7 (learning) is 0 by
// construction (m7Learning) and a bar of `meanAtLeast: 1` over all nine is
// arithmetically unreachable — capping a first run at 8/9. That is not a
// capability statement, so the honest fix is a bar that judges a first run on
// the criteria it CAN score, not a lowered bar. Warm runs keep the full bar.
// This module owns the pure semantics; the driver reads the declared bar from
// the grader (`passWhen`) and selects by run kind.
//
// 342-3 vB (verifier B): the declared block is normalized, never trusted — the
// driver's parseGrader accepts any (0,1] threshold and any criterion subset,
// so barForRunKind structurally clamps exclusions to
// FIRST_RUN_UNSCOREABLE_CRITERIA and forces the threshold to
// FIRST_RUN_BAR_MEAN_ATLEAST (1: every remaining criterion). A loose grader
// can no longer make a floor-shaped card pass; firstRunBarIsAdmissible lets a
// loader reject one loudly instead.
// ---------------------------------------------------------------------------

/** first = no prior same-slug run (M7 unscoreable); warm = a prior exists. */
export type MakerRunKind = "first" | "warm";

/** A grader's threshold, as maker-score reads it. `meanAtLeast` is the WARM
 *  bar (all nine criteria). `firstRun`, when declared, is the bar a first run
 *  is judged on: the declared `meanAtLeast` is taken over the card's criteria
 *  MINUS `excludeCriteria` (the criteria a first run legally cannot score).
 *  Omitting a criterion is not lowering the bar — every criterion is 0/1, so a
 *  required mean of 1 over the remaining eight demands all eight, exactly as
 *  the warm bar demands all nine. A grader with no `firstRun` block keeps the
 *  warm bar for first runs too (back-compat).
 *
 *  342-3 vB (verifier B): the declared block is NOT trusted. `barForRunKind`
 *  applies the only admissible first-run semantics structurally — exclusions
 *  clamped to FIRST_RUN_UNSCOREABLE_CRITERIA and the threshold forced to
 *  FIRST_RUN_BAR_MEAN_ATLEAST — so a loose grader (a 0.5 threshold, or an
 *  exclusion of scoreable criteria) cannot loosen the bar even though
 *  parseGrader accepts it. `firstRunBarIsAdmissible` exposes the same rule as
 *  a predicate so a loader can reject such a grader loudly instead. */
export type MakerBarWhen = {
  meanAtLeast: number;
  firstRun?: { meanAtLeast: number; excludeCriteria: MakerCriterionId[] } | null;
};

/** The criteria a first run cannot earn evidence for. M7 (learning) is the
 *  only one: with no prior there is no lesson to reuse. Excluded from the
 *  first-run bar and only from it. */
export const FIRST_RUN_UNSCOREABLE_CRITERIA: readonly MakerCriterionId[] = ["M7"];

/** A first run can score every criterion except the genuinely unscoreable ones
 *  (M7), and they are all 0/1 — so the only honest first-run threshold is 1
 *  (ALL the remaining criteria). A weaker declared threshold is a defect that
 *  would let a floor-shaped card pass; barForRunKind refuses to honor it. */
export const FIRST_RUN_BAR_MEAN_ATLEAST = 1;

/** first | warm, from the prior evidence the driver resolved. */
export function runKindOf(prior: MakerPriorEvidence | null | undefined): MakerRunKind {
  return prior ? "warm" : "first";
}

/** The threshold + excluded criteria that apply to a run of `runKind`. The
 *  first-run branch is DERIVED, never trusted: exclusions are intersected with
 *  FIRST_RUN_UNSCOREABLE_CRITERIA (a grader cannot exclude a scoreable
 *  criterion to duck it) and the threshold is FIRST_RUN_BAR_MEAN_ATLEAST (all
 *  remaining criteria). A grader with no `firstRun` block keeps the warm bar. */
export function barForRunKind(
  when: MakerBarWhen,
  runKind: MakerRunKind,
): { meanAtLeast: number; excludeCriteria: MakerCriterionId[] } {
  if (runKind === "first" && when.firstRun) {
    const admissible = new Set<MakerCriterionId>(FIRST_RUN_UNSCOREABLE_CRITERIA);
    const excludeCriteria = when.firstRun.excludeCriteria.filter((id) => admissible.has(id));
    return { meanAtLeast: FIRST_RUN_BAR_MEAN_ATLEAST, excludeCriteria };
  }
  return { meanAtLeast: when.meanAtLeast, excludeCriteria: [] };
}

/** 342-3 vB: whether a declared `firstRun` block is admissible. `barForRunKind`
 *  applies these rules structurally (a loose block can never loosen the bar);
 *  this predicate lets a LOADER reject one loudly instead of silently
 *  normalizing it. `defects` is empty iff admissible. A block whose
 *  `meanAtLeast` is anything but FIRST_RUN_BAR_MEAN_ATLEAST, or that names any
 *  criterion outside FIRST_RUN_UNSCOREABLE_CRITERIA, is inadmissible. */
export function firstRunBarIsAdmissible(when: MakerBarWhen): { ok: boolean; defects: string[] } {
  const defects: string[] = [];
  if (when.firstRun) {
    if (when.firstRun.meanAtLeast !== FIRST_RUN_BAR_MEAN_ATLEAST) {
      defects.push(
        `firstRun.meanAtLeast must be ${FIRST_RUN_BAR_MEAN_ATLEAST} (every remaining criterion is required), got ${JSON.stringify(when.firstRun.meanAtLeast)}`,
      );
    }
    const admissible = new Set<string>(FIRST_RUN_UNSCOREABLE_CRITERIA);
    const illegal = when.firstRun.excludeCriteria.filter((id) => !admissible.has(id));
    if (illegal.length > 0) {
      defects.push(
        `firstRun.excludeCriteria may name only the genuinely unscoreable ${[...admissible].join("|")}, got extra ${illegal.join(", ")}`,
      );
    }
  }
  return { ok: defects.length === 0, defects };
}

/** Mean of the criteria NOT in `excludeCriteria` (0, never NaN, when every
 *  criterion is excluded — a bar with nothing to score is not a pass). */
export function criteriaMeanExcluding(
  card: Pick<MakerScoreCard, "criteria">,
  excludeCriteria: readonly MakerCriterionId[] = [],
): number {
  const ids = (Object.keys(card.criteria) as MakerCriterionId[]).filter((id) => !excludeCriteria.includes(id));
  if (ids.length === 0) return 0;
  return ids.reduce((acc, id) => acc + card.criteria[id].score, 0) / ids.length;
}

/** Whether a card clears its run-kind threshold. This is the RUBRIC clause
 *  only; the run-side files/content/behavior/kind clauses stay with the
 *  driver (run-eval's passesAcceptance), so this can never relax them. */
export function meetsRunKindBar(
  card: Pick<MakerScoreCard, "criteria">,
  when: MakerBarWhen,
  runKind: MakerRunKind,
): { ok: boolean; mean: number; meanAtLeast: number; excludeCriteria: MakerCriterionId[] } {
  const bar = barForRunKind(when, runKind);
  const mean = criteriaMeanExcluding(card, bar.excludeCriteria);
  return { ok: mean >= bar.meanAtLeast, mean, meanAtLeast: bar.meanAtLeast, excludeCriteria: bar.excludeCriteria };
}
