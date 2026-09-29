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
 *   M4 verifiable — lastTest.label === "tested" AND an evidenceHash exists
 *                   (the p6-verified probe semantics, dod.ts).
 *   M5 honest     — no red gate record, OR every red gate surfaced loudly
 *                   (sealedWithFailures flag / census log / warn gate.verdict);
 *                   0 when a red gate hides under a clean seal.
 *   M6 handover   — emitted dir exists with DEPLOY.md + a real oracle spec
 *                   (driver-gathered fs evidence).
 *   M7 learning   — optional prior same-domain run: this run's M1+M2+M3 sum
 *                   ≥ the prior run's (no prior = 0, no claim without data).
 *   M8 bounded    — journey stayed within its configured budget (param).
 *   M9 on-time    — run stopped on time; a refused/abnormal stop is 1 only
 *                   when it parked LOUDLY with a code (never silent).
 */
import type { Project } from "./types.ts";
import type { TreeRunOutcome } from "./compile-check.server.ts";
import { canonicalStem } from "./algorithms.ts";
import { isStubSource } from "./dod.ts";
import { BRIEF_STOPWORDS, briefNounHits, identifierHits } from "./sandbox.ts";

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

/** M7 evidence: the prior same-domain run's M1..M3 (driver reads its own
 *  persisted history; absent on the first run of a slug). */
export type MakerPriorEvidence = {
  m1: number;
  m2: number;
  m3: number;
} | null;

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
  behavioral?: { pass: number; fail: number; failedIds?: string[] } | null;
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

/** The p6-brief-fit probe semantics (dod.ts), verbatim: ≥ half (min 1) of the
 *  brief's required nouns appear as identifiers in `source`. Vocabulary-free
 *  briefs pass vacuously. */
export function p6BriefFitPasses(brief: string, source: string): boolean {
  const required = briefNounHits(brief).required;
  if (required.length === 0) return true;
  const hits = identifierHits(required, typeof source === "string" ? source : "");
  return hits.length >= Math.max(1, Math.ceil(required.length * 0.5));
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

function lastTestEvidence(project: Project): { label?: string; ok?: boolean; evidenceHash?: string } | null {
  const lt = project.lastTest as { label?: string; ok?: boolean; evidenceHash?: string } | null;
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
    return {
      score: 1,
      evidence: `derived convergence: P6 gate passed (${gate.evidenceHash.slice(0, 8)}) + lastTest ok (${lt.label ?? "unlabeled"})`,
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

/** M4 machine-verifiable — p6-verified semantics: lastTest.label === "tested"
 *  plus a real evidenceHash. */
export function m4MachineVerifiable(input: MakerScoreInput): MakerCriterion {
  const lt = lastTestEvidence(input.project);
  const tested = lt && lt.label === "tested";
  const hashed =
    tested && typeof lt!.evidenceHash === "string" && (lt!.evidenceHash as string).length > 0;
  if (tested && hashed) {
    return { score: 1, evidence: `lastTest "tested" + evidenceHash ${(lt!.evidenceHash as string).slice(0, 8)}` };
  }
  return {
    score: 0,
    evidence: `machine verification missing: lastTest ${lt ? `label="${lt.label ?? "unlabeled"}"${typeof lt.evidenceHash === "string" && lt.evidenceHash ? " + hash" : " + NO evidenceHash"}` : "absent"}`,
  };
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

/** M7 learning — with a prior same-domain run, M1+M2+M3 must not regress. */
export function m7Learning(input: MakerScoreInput): MakerCriterion {
  const prior = input.prior;
  if (!prior) {
    return { score: 0, evidence: "no prior same-domain run — no learning claim without data" };
  }
  const mineSum = m1Substance(input).score + m2Runs(input).score + m3Iterates(input).score;
  const priorSum = (prior.m1 ?? 0) + (prior.m2 ?? 0) + (prior.m3 ?? 0);
  if (mineSum >= priorSum) {
    return {
      score: 1,
      evidence: `M1+M2+M3 ${mineSum} ≥ prior same-domain ${priorSum} (m1 ${prior.m1}/m2 ${prior.m2}/m3 ${prior.m3})`,
    };
  }
  return {
    score: 0,
    evidence: `M1+M2+M3 ${mineSum} < prior same-domain ${priorSum} — regression (m1 ${prior.m1}/m2 ${prior.m2}/m3 ${prior.m3})`,
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
  // M5-M9 stay byte-identical — including M7, whose internal M1+M2+M3 math
  // runs over the UNFORCED criteria (a run that refused everything is not a
  // learning regression; the learning criteria judge the run's own motion,
  // and its card is already floored). The gate is a CARD-level override: the
  // exported m1..m4 criteria keep their own semantics for direct callers.
  // synthesisSucceeded true/undefined → byte-identical legacy behavior.
  if (input.synthesisSucceeded === false) {
    const floor: MakerCriterion = { score: 0, evidence: FLOOR_QUALIFIER_EVIDENCE };
    criteria.M1 = { ...floor };
    criteria.M2 = { ...floor };
    criteria.M3 = { ...floor };
    criteria.M4 = { ...floor };
  }
  const total = Object.values(criteria).reduce((acc, c) => acc + c.score, 0);
  return { criteria, total, mean: total / 9 };
}
