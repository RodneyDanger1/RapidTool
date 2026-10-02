// ---------------------------------------------------------------------------
// bench.ts — synthetic dry-run estimates for the generate→verify pipeline.
//
// Pillar-12 companion to the Pillar-4 verify loop (verify.server.ts): answer
// "how expensive / risky is this project's build?" BEFORE it runs, purely from
// static signals already on the Project (brief, generatedSource, artifacts,
// phase records). NO LLM calls, NO timers, NO randomness, NO filesystem —
// every function is pure and deterministic.
//
// Honesty contract: every estimate returns `estimate: true`, a `method`
// string naming the exact formula, and a `label` stating it is a SYNTHETIC
// DRY-RUN estimate — never a measured value. All analysis is regular-
// expression / line-scan heuristics, not a parser, tokenizer or compiler;
// string literals and comments are stripped first (stripStringsAndComments)
// so they cannot false-positive the scans, but other documented noise (e.g.
// identifiers inside regex literals) remains possible.
//
// Input contract: functions accept a structural SUBSET of the store `Project`
// (types.ts) — { brief, generatedSource, artifacts, phases } — so a real
// Project object can be passed directly; test fixtures only need the fields
// an estimator actually reads. Phase records follow the store PhaseStatus
// vocabulary: complete | rejected = work happened (full weight), running |
// awaiting_hitl = in flight (half weight), ready | locked = not started (0).
// ---------------------------------------------------------------------------
export type BenchArtifactLike = { body?: unknown };
export type BenchPhaseLike = { id?: number | string; status?: string };
export type BenchProject = {
  brief?: string;
  generatedSource?: string;
  artifacts?: readonly BenchArtifactLike[] | null;
  phases?: readonly BenchPhaseLike[] | null;
};

// -- Honest labels (exported so callers can persist/search on them) ---------
export const ESTIMATE_DISCLAIMER = "synthetic dry-run estimate — heuristic, not a measured run";
export const TOKEN_ESTIMATE_LABEL = `Token cost: ${ESTIMATE_DISCLAIMER} (chars/4 + per-phase overhead multipliers).`;
export const TIME_ESTIMATE_LABEL = `Projected time: ${ESTIMATE_DISCLAIMER} (phase-weighted minutes).`;
export const COMPLEXITY_ESTIMATE_LABEL = `Complexity: ${ESTIMATE_DISCLAIMER} (branch/loop heuristics + artifact weight).`;
export const FAILURE_POINT_LABEL = `Failure points: ${ESTIMATE_DISCLAIMER} (regex/structural signals; advisory only).`;

// -- Phase tables ------------------------------------------------------------
// Minutes a phase typically costs (human review included for HITL phases).
// Synthetic calibration constants — pinned by tests; tune deliberately.
export const PHASE_MINUTES: Readonly<Record<number, number>> = {
  0: 45, // Deep Research & Feasibility
  1: 40, // Core Orchestration & State Graph
  2: 30, // Memory & Context Consolidation
  3: 30, // Tool Integration & Interoperability
  4: 30, // Security, Isolation & Authorization (HITL)
  5: 35, // Validation, HITL & Self-Learning (HITL)
  6: 60, // Code Generation, Testing & Deployment (verify loop lives here)
  7: 30, // Domain & Market Research
  8: 45, // Dynamic UI/UX Prototyping (HITL)
  9: 30, // CI/CD & Cloud Deployment Routing (HITL)
  10: 25, // Local Agent & Edge Inference
  11: 30, // Real-Time Web & Tool Augmentation
  12: 20, // Documentation & Technical Specs
};
export const DEFAULT_PHASE_MINUTES = 30;

// Prompt/context overhead multiplier per phase (research phases replay more
// context into later prompts than lean ones). Unknown ids get 1.0.
export const PHASE_TOKEN_MULTIPLIERS: Readonly<Record<number, number>> = {
  0: 3,
  1: 1.6,
  2: 1.4,
  3: 1.5,
  4: 1.4,
  5: 1.6,
  6: 2.4,
  7: 2.2,
  8: 2,
  9: 1.4,
  10: 1.2,
  11: 1.8,
  12: 1.5,
};
export const DEFAULT_PHASE_TOKEN_MULTIPLIER = 1;
/** Fixed token overhead attributed to each participated phase (prompting + context replay). */
export const PHASE_OVERHEAD_TOKENS = 250;
/** Long-function advisory threshold (newlines between openers). */
export const LONG_FUNCTION_NEWLINES = 40;

// ---------------------------------------------------------------------------
// Shared text primitives (exported — verify.server.ts lintFailures reuses the
// exact same scrubbing + loose-equality logic so the two heuristics cannot
// drift apart).
// ---------------------------------------------------------------------------

/**
 * Replace string literals ('...', "...", `...`) and both comment styles with
 * spaces, KEEPING newlines, so every input index maps 1:1 onto the output.
 * Quote- and escape-aware; used to make regex heuristics immune to data
 * inside strings/comments. Pure; never throws.
 */
export function stripStringsAndComments(source: string): string {
  const src = typeof source === "string" ? source : "";
  let out = "";
  let state: "normal" | "sq" | "dq" | "tick" | "line" | "block" = "normal";
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];
    if (state === "line") {
      out += ch === "\n" || ch === "\r" ? ch : " ";
      if (ch === "\n" || ch === "\r") state = "normal";
      continue;
    }
    if (state === "block") {
      out += ch === "\n" ? ch : " ";
      if (ch === "*" && next === "/") {
        out += " ";
        i++;
        state = "normal";
      }
      continue;
    }
    if (state !== "normal") {
      out += ch === "\n" ? ch : " ";
      if (ch === "\\" && next !== undefined) {
        out += next === "\n" ? "\n" : " ";
        i++;
      } else if (
        (state === "sq" && ch === "'") ||
        (state === "dq" && ch === '"') ||
        (state === "tick" && ch === "`")
      ) {
        state = "normal";
      }
      continue;
    }
    if (ch === "'") state = "sq";
    else if (ch === '"') state = "dq";
    else if (ch === "`") state = "tick";
    else if (ch === "/" && next === "/") {
      state = "line";
      out += " ";
      i++;
      out += " ";
      continue;
    } else if (ch === "/" && next === "*") {
      state = "block";
      out += " ";
      i++;
      out += " ";
      continue;
    }
    out += ch;
  }
  return out;
}

/**
 * Count loose-equality `==` comparisons, excluding `===`, `!==`, `=>`, `<=`,
 * `>=` and any `==` that lives inside a string/comment (callers pass the
 * scrubbed source). Pure; deterministic.
 */
export function countLooseEquals(scrubbed: string): number {
  const text = typeof scrubbed === "string" ? scrubbed : "";
  let n = 0;
  for (let i = 0; i < text.length - 1; i++) {
    if (
      text[i] === "=" &&
      text[i + 1] === "=" &&
      text[i - 1] !== "=" &&
      text[i - 1] !== "!" &&
      text[i + 2] !== "="
    ) {
      n++;
    }
  }
  return n;
}

function coerceString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function toObject(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function lineAt(text: string, index: number): number {
  let line = 1;
  const end = Math.min(index, text.length);
  for (let i = 0; i < end; i++) if (text[i] === "\n") line++;
  return line;
}

function countMatches(text: string, re: RegExp): number {
  re.lastIndex = 0;
  let n = 0;
  for (const _m of text.matchAll(re)) n++;
  return n;
}

/** Phase status → participation weight (see header contract). */
export function phaseStatusWeight(status: unknown): number {
  if (status === "complete" || status === "rejected") return 1;
  if (status === "running" || status === "awaiting_hitl") return 0.5;
  return 0;
}

function numericPhaseId(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw))) {
    return Number(raw);
  }
  return null;
}

export type PhaseParticipation = {
  id: number | null;
  status: string;
  weight: number;
};

/** Participated phase records (weight > 0), in input order. Pure. */
export function participatedPhases(project: BenchProject): PhaseParticipation[] {
  const phases = project && Array.isArray(project.phases) ? project.phases : [];
  const out: PhaseParticipation[] = [];
  for (const rec of phases) {
    const obj = toObject(rec);
    if (!obj) continue;
    const weight = phaseStatusWeight(obj.status);
    if (weight <= 0) continue;
    out.push({
      id: numericPhaseId(obj.id),
      status: typeof obj.status === "string" ? obj.status : "",
      weight,
    });
  }
  return out;
}

export function minutesForPhase(id: number | null): number {
  if (id !== null && id >= 0 && PHASE_MINUTES[id] !== undefined) return PHASE_MINUTES[id];
  return DEFAULT_PHASE_MINUTES;
}

export function multiplierForPhase(id: number | null): number {
  if (id !== null && id >= 0 && PHASE_TOKEN_MULTIPLIERS[id] !== undefined) {
    return PHASE_TOKEN_MULTIPLIERS[id];
  }
  return DEFAULT_PHASE_TOKEN_MULTIPLIER;
}

// ---------------------------------------------------------------------------
// 1) estimateTokenCost(project) — chars/4 token heuristic + per-phase
//    overhead multipliers. Returns an honest labelled estimate, never a count.
// ---------------------------------------------------------------------------
export type TokenCostEstimate = {
  estimate: true;
  method: string;
  label: string;
  tokenEstimate: number;
  briefChars: number;
  sourceChars: number;
  artifactChars: number;
  totalChars: number;
  sourceTokenEstimate: number;
  phaseOverheadTokens: number;
  artifactCount: number;
  participatedPhases: number;
  perPhase: { id: number | null; status: string; multiplier: number; tokens: number }[];
};

export function estimateTokenCost(project: BenchProject): TokenCostEstimate {
  const p: BenchProject = project && typeof project === "object" ? project : {};
  const brief = coerceString(p.brief);
  const src = coerceString(p.generatedSource);
  const artifacts = Array.isArray(p.artifacts) ? p.artifacts : [];
  let artifactChars = 0;
  for (const a of artifacts) {
    const obj = toObject(a);
    if (obj && typeof obj.body === "string") artifactChars += obj.body.length;
  }
  const briefChars = brief.length;
  const sourceChars = src.length;
  const totalChars = briefChars + sourceChars + artifactChars;
  const sourceTokenEstimate = Math.ceil(totalChars / 4);
  const perPhase: TokenCostEstimate["perPhase"] = [];
  let phaseOverheadTokens = 0;
  for (const rec of participatedPhases(p)) {
    const multiplier = multiplierForPhase(rec.id);
    const tokens = Math.round(PHASE_OVERHEAD_TOKENS * multiplier * rec.weight);
    phaseOverheadTokens += tokens;
    perPhase.push({ id: rec.id, status: rec.status, multiplier, tokens });
  }
  return {
    estimate: true,
    method: "ceil(totalChars/4) + Σ round(250 × phaseMultiplier × statusWeight)",
    label: TOKEN_ESTIMATE_LABEL,
    tokenEstimate: sourceTokenEstimate + phaseOverheadTokens,
    briefChars,
    sourceChars,
    artifactChars,
    totalChars,
    sourceTokenEstimate,
    phaseOverheadTokens,
    artifactCount: artifacts.length,
    participatedPhases: perPhase.length,
    perPhase,
  };
}

// ---------------------------------------------------------------------------
// 2) complexityScore(project) — branch/loop heuristics over generatedSource
//    plus artifact weight. Deterministic score + honesty band.
// ---------------------------------------------------------------------------
export type ComplexityDetail = {
  ifCount: number;
  loopCount: number;
  switchCount: number;
  catchCount: number;
  ternaryCount: number;
  logicalOpCount: number;
  functionCount: number;
  artifactCount: number;
};

export type ComplexityEstimate = {
  estimate: true;
  method: string;
  label: string;
  score: number;
  level: "low" | "medium" | "high";
  detail: ComplexityDetail;
};

export function complexityScore(project: BenchProject): ComplexityEstimate {
  const p: BenchProject = project && typeof project === "object" ? project : {};
  const text = stripStringsAndComments(coerceString(p.generatedSource));
  const artifactCount = Array.isArray(p.artifacts) ? p.artifacts.length : 0;
  const ifCount = countMatches(text, /\bif\s*\(/g);
  const loopCount = countMatches(text, /\b(?:for|while|do)\s*\(/g);
  const switchCount = countMatches(text, /\bswitch\s*\(/g);
  const catchCount = countMatches(text, /\bcatch\b/g);
  let ternaryCount = 0;
  for (let i = 0; i < text.length; i++) {
    // A real ternary is `? :`; `??` (nullish) and `?.` (optional chaining) are
    // NOT ternaries — exclude both by looking at the char AFTER the `?`.
    if (text[i] === "?" && text[i - 1] !== "?" && text[i - 1] !== "." && text[i + 1] !== "?" && text[i + 1] !== ".") {
      ternaryCount++;
    }
  }
  const logicalOpCount = countMatches(text, /&&/g) + countMatches(text, /\|\|/g);
  const functionCount = countMatches(text, /\bfunction\b/g) + countMatches(text, /=>/g);
  const detail: ComplexityDetail = {
    ifCount,
    loopCount,
    switchCount,
    catchCount,
    ternaryCount,
    logicalOpCount,
    functionCount,
    artifactCount,
  };
  const score =
    2 * ifCount + 3 * loopCount + 2 * switchCount + catchCount + ternaryCount + logicalOpCount + 2 * artifactCount;
  const level: ComplexityEstimate["level"] = score < 8 ? "low" : score < 20 ? "medium" : "high";
  return {
    estimate: true,
    method: "score = 2×if + 3×loop + 2×switch + catch + ternary + logical(&&/||) + 2×artifact",
    label: COMPLEXITY_ESTIMATE_LABEL,
    score,
    level,
    detail,
  };
}

// ---------------------------------------------------------------------------
// 3) failurePointScan(project) — structural/regex heuristics that flag where
//    the module is LIKELY to fail machine verification. Advisory list only.
// ---------------------------------------------------------------------------
export type FailureAdvisory = {
  code: "missing-exports" | "long-function" | "eqeqeq" | "no-unused-decl";
  severity: "low" | "medium" | "high";
  message: string;
  line: number | null;
  occurrences: number;
};

export type FailurePointScan = {
  estimate: true;
  method: string;
  label: string;
  count: number;
  advisories: FailureAdvisory[];
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function failurePointScan(project: BenchProject): FailurePointScan {
  const p: BenchProject = project && typeof project === "object" ? project : {};
  const raw = coerceString(p.generatedSource);
  const src = stripStringsAndComments(raw);
  const advisories: FailureAdvisory[] = [];
  if (src.trim() !== "") {
    const hasExports = /\bexports\s*\.|module\.exports|^export\s+/m.test(src);
    const looksLikeModule = /\b(?:function|class)\b|=>|^\s*(?:const|let|var)\s+[A-Za-z_$]/m.test(src);
    if (!hasExports && looksLikeModule) {
      advisories.push({
        code: "missing-exports",
        severity: "high",
        message:
          "no module exports found (exports.x / module.exports) — the oracle harness's with(exports) can reference nothing, so every case will fail at runtime",
        line: null,
        occurrences: 1,
      });
    }
    // Long functions: consecutive openers delimit an approximate body span.
    const openers = /\b(?:function\s+([A-Za-z_$][A-Za-z0-9_$]*)|(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>)/g;
    const found: { name: string; start: number }[] = [];
    let m: RegExpExecArray | null;
    openers.lastIndex = 0;
    while ((m = openers.exec(src)) !== null) {
      const name = m[1] || m[2] || "(anonymous)";
      found.push({ name, start: m.index });
    }
    for (let i = 0; i < found.length; i++) {
      const spanEnd = i + 1 < found.length ? found[i + 1].start : src.length;
      const bodyNewlines = countMatches(src.slice(found[i].start, spanEnd), /\n/g);
      if (bodyNewlines > LONG_FUNCTION_NEWLINES) {
        advisories.push({
          code: "long-function",
          severity: "medium",
          message: `function '${found[i].name}' spans ≈${bodyNewlines + 1} lines (threshold ${LONG_FUNCTION_NEWLINES + 1}) — long bodies are the most common first-fix target`,
          line: lineAt(raw, found[i].start),
          occurrences: 1,
        });
      }
    }
    const loose = countLooseEquals(src);
    if (loose > 0) {
      let firstLoose: number | null = null;
      for (let i = 0; i < src.length - 1; i++) {
        if (
          src[i] === "=" &&
          src[i + 1] === "=" &&
          src[i - 1] !== "=" &&
          src[i - 1] !== "!" &&
          src[i + 2] !== "="
        ) {
          firstLoose = i;
          break;
        }
      }
      advisories.push({
        code: "eqeqeq",
        severity: "low",
        message: `${loose} loose == comparison${loose > 1 ? "s" : ""} — strict === is the house style (first at line ${firstLoose !== null ? lineAt(raw, firstLoose) : "?"})`,
        line: firstLoose !== null ? lineAt(raw, firstLoose) : null,
        occurrences: loose,
      });
    }
    // Unused-var-ish: top-level const/let/var whose name never appears after
    // its declaration (whole-word, string/comment noise already scrubbed).
    const decls = /^[ \t]*(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=/gm;
    let d: RegExpExecArray | null;
    decls.lastIndex = 0;
    while ((d = decls.exec(src)) !== null) {
      const name = d[1];
      const rest = src.slice(d.index + d[0].length);
      const uses = countMatches(rest, new RegExp(`\\b${escapeRegExp(name)}\\b`, "g"));
      if (uses === 0) {
        advisories.push({
          code: "no-unused-decl",
          severity: "low",
          message: `declared '${name}' is never referenced after its declaration — dead code or a missing export wiring`,
          line: lineAt(raw, d.index),
          occurrences: 1,
        });
      }
    }
  }
  return {
    estimate: true,
    method: "regex/structural heuristics (exports, function spans, loose ==, dead declarations)",
    label: FAILURE_POINT_LABEL,
    count: advisories.length,
    advisories,
  };
}

// ---------------------------------------------------------------------------
// 4) projectedTime(project) — phase-weighted minutes over participated phase
//    records (complete/rejected full; running/awaiting_hitl half).
// ---------------------------------------------------------------------------
export type TimeEstimate = {
  estimate: true;
  method: string;
  label: string;
  minutes: number;
  completedPhases: number;
  inFlightPhases: number;
  participatedPhases: number;
  contributions: { id: number | null; status: string; minutes: number }[];
};

export function projectedTime(project: BenchProject): TimeEstimate {
  const p: BenchProject = project && typeof project === "object" ? project : {};
  const contributions: TimeEstimate["contributions"] = [];
  let minutes = 0;
  let completedPhases = 0;
  let inFlightPhases = 0;
  for (const rec of participatedPhases(p)) {
    const part = Math.round(minutesForPhase(rec.id) * rec.weight);
    minutes += part;
    if (rec.weight >= 1) completedPhases++;
    else inFlightPhases++;
    contributions.push({ id: rec.id, status: rec.status, minutes: part });
  }
  return {
    estimate: true,
    method: "Σ round(phaseMinutes × statusWeight) over participated phase records",
    label: TIME_ESTIMATE_LABEL,
    minutes,
    completedPhases,
    inFlightPhases,
    participatedPhases: contributions.length,
    contributions,
  };
}
