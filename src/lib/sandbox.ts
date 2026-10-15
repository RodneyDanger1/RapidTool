import { canonicalStem } from "./algorithms.ts";
import type { ErrorCode } from "./errors.ts";

// A02 (deep-audit-01): the denylist below must target ACTUAL primitive /
// identifier usage in code — never engine-injected TEXT inside string literals
// or comments. buildPhase6Module injects JSON-escaped literals (job names,
// project name, the rejection note) whose prose can legitimately contain
// denylist words ("…document the flow and process each job in order…"), and
// those words used to fail the whole P6 module and strand the project in a
// forceHuman HITL with no UI override. So literals + comments are masked out
// first (maskLiteralsAndComments) and the regex only ever sees real code.
// Every token is a word-boundary identifier; bare `fetch`/`WebSocket`/`self`/
// `window` are banned too (A13) — the sync path runs in the page global, so a
// bare `fetch(` is a real network escape, not just `window.fetch(`.
// `enum` (this wave) is NOT a runtime primitive but a TypeScript-ONLY construct
// with runtime emission, so a candidate that carries `enum X {}` is refused
// here rather than shipped: Node's type-stripping (`--experimental-strip-types`
// / the default on Node >= 22.18) cannot erase it and dies with
// `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`, breaking the whole emitted tree. It is a
// reserved word in JS, so it can never be a legitimate identifier — the ban is
// a pure false-negative fix with no false-positive cost (a `enum` inside a
// literal/comment is masked out below like every other token).
const FORBIDDEN =
  /\b(process|require|globalThis|window|self|fetch|WebSocket|XMLHttpRequest|eval|Function|import|document|localStorage|indexedDB|enum)\b/;

/** Exported denylist for keyed-synthesis producers (P0-01 Part B validation). */
export const FORBIDDEN_PRIMITIVES = FORBIDDEN;

/**
 * 322 X1 (P6 fix): bounded regex-literal scan for the masker below. Returns the
 * exclusive end index of a regex literal starting at `i`, or -1 when `i` does
 * not plausibly open one (division, or unterminated on its line). `/"/g`-style
 * escape regexes are routine in generated code (`.replace(/"/g, "&quot;")`);
 * without this the scanner read the regex's quote chars as string openers and
 * cascaded (322 X1 evidence: first divergence update.ts:692; 447-char tail +
 * whole sibling files masked out of the tree union). Lexical split only — not
 * a parser: a `/` opens a regex right after an operator/opening delimiter or a
 * regex-legal keyword, or after a `)` that closes a control-statement header —
 * never after an identifier, literal or `]`).
 */

/** Control-statement keywords whose `)` terminates a header after which a `/`
 *  begins a statement (a regex literal), never a division. */
const CONTROL_HEADER_KEYWORDS: ReadonlySet<string> = new Set([
  "if", "while", "for", "with", "switch", "catch",
]);

/**
 * Does the `)` at `closeIdx` close a control-statement header (`if (…)`,
 * `while (…)`, `for (…)`, …)? Walks back to the matching `(` (paren depth on
 * the RAW source — a paren inside a nested string is a best-effort lexical
 * limit, not a parser) and reads the identifier immediately before it. A real
 * function call can never precede its own `(` with one of the pinned reserved
 * words, so this only ever WIDENS regex detection for the one position where a
 * regex statement is legal — it can not mask a genuine division. Pure.
 */
function closesControlHeader(src: string, closeIdx: number): boolean {
  let depth = 0;
  for (let k = closeIdx; k >= 0; k--) {
    const ch = src[k];
    if (ch === ")") depth++;
    else if (ch === "(") {
      depth--;
      if (depth !== 0) continue;
      let e = k - 1;
      while (e >= 0 && /\s/.test(src[e]!)) e--;
      let s = e;
      while (s >= 0 && /[A-Za-z]/.test(src[s]!)) s--;
      return CONTROL_HEADER_KEYWORDS.has(src.slice(s + 1, e + 1));
    }
  }
  return false;
}

function regexLiteralEnd(src: string, i: number): number {
  let k = i - 1;
  while (k >= 0 && (src[k] === " " || src[k] === "\t")) k--;
  const prev = k < 0 ? "\n" : src[k];
  const keyword =
    /\b(return|typeof|case|in|of|new|delete|void|instanceof|do|else|yield|await|throw)$/.test(
      src.slice(Math.max(0, k - 13), k + 1),
    );
  // A `/window/`-style regex as an `if`/`while` BODY: the header's `)` is a
  // complete syntactic unit, so the following `/` starts a statement. Reading
  // it as division left the regex body VISIBLE and refused legitimate code that
  // merely matched the word inside its own pattern (false positive, this wave).
  const controlHeader = prev === ")" && closesControlHeader(src, k);
  if (prev !== "\n" && !"(,=:[!&|?{};+-*%^~<>".includes(prev) && !keyword && !controlHeader) return -1;
  // 325 A3: `+`/`-` open a regex only as a BINARY operator. `i++ / 2` is a
  // division (the TS lexer says so), but the sign pair read as an operator
  // position and the scanner then consumed to the next `/` on the line —
  // masking real code out of the FORBIDDEN scan (a hidden `fetch`/`window`
  // is an anti-gaming hole) and out of identifierHits, or leaving a real
  // regex's body VISIBLE (a false forbidden hit). When the char before the
  // sign is another sign, the pair is postfix `++`/`--`: division, not a
  // regex opener. Prefix `++i / 2` (prev = identifier char) was already
  // handled; binary `a + /re/` (prev sign, prior operand) stays a regex.
  if (prev === "+" || prev === "-") {
    let b = k - 1;
    while (b >= 0 && (src[b] === " " || src[b] === "\t")) b--;
    const before = b < 0 ? "\n" : src[b];
    if (before === "+" || before === "-") return -1;
  }
  let j = i + 1;
  let inClass = false;
  while (j < src.length) {
    const d = src[j];
    if (d === "\\") { j += 2; continue; }
    if (d === "\n") return -1;
    if (d === "[") inClass = true;
    else if (d === "]") inClass = false;
    else if (d === "/" && !inClass) {
      j++;
      while (j < src.length && /[a-z]/i.test(src[j])) j++;
      return j;
    }
    j++;
  }
  return -1;
}

/**
 * Masks string literals ('…', "…", `…`) and comments (line and block comments)
 * with spaces, so FORBIDDEN scans code tokens only. Replacing with same-length
 * spaces preserves token separation (a string can never weld two code
 * identifiers together into a banned word).
 *
 * 350 (this wave): a TEMPLATE literal's `${…}` interpolation body is CODE, not
 * text — `` `${globalThis.location}` `` really does read the global. The old
 * masker blanked the WHOLE backtick span (interpolations included), so a
 * forbidden primitive that lived only inside `${…}` escaped the scan (a false
 * negative observed in candidates). Now the literal TEXT stays masked while each
 * interpolation body is scanned as code, nesting-aware (a nested template's own
 * interpolation recurses). Defense note: this lexical mask is not a parser —
 * the denylist is defense-in-depth for the sync engine-template path.
 *
 * The worker-isolate boundary this comment once pointed to (runSandboxed, "the
 * real boundary for non-template source") is deprecated as a product executor
 * (E-29): the Node host has no DOM Worker and runSandboxed has zero product
 * call sites — see its deprecation note.
 */
/** Masks string literals and comments with spaces (exported for P0-01 brief-fit probes). */
export function maskLiteralsAndComments(src: string): string {
  const n = src.length;
  const out = new Array<string>(n).fill(" ");
  /** Mask a '…'/"…" span at its opening quote; returns the index AFTER the
   *  closing quote (or EOF). Escapes are skipped, as before. */
  const maskQuoted = (start: number): number => {
    const quote = src[start];
    let j = start + 1;
    while (j < n) {
      if (src[j] === "\\") {
        j += 2;
        continue;
      }
      if (src[j] === quote) return j + 1;
      j++;
    }
    return n;
  };
  /** Mask a `…${code}…` template at its opening backtick. Literal text stays
   *  spaces; each `${…}` body is scanned as CODE (visible again). Returns the
   *  index AFTER the closing backtick. */
  const maskTemplate = (start: number): number => {
    let j = start + 1;
    while (j < n) {
      const ch = src[j]!;
      if (ch === "\\") {
        j += 2;
        continue;
      }
      if (ch === "`") return j + 1;
      if (ch === "$" && src[j + 1] === "{") {
        j = scanCode(j + 2, true);
        continue;
      }
      j++;
    }
    return n;
  };
  /** Scan a CODE region, masking literals/comments/regexes in place and copying
   *  real code characters into `out`. With `stopOnBrace`, returns just past the
   *  `}` that closes the current template interpolation. */
  const scanCode = (start: number, stopOnBrace: boolean): number => {
    let j = start;
    let depth = 0;
    while (j < n) {
      const c = src[j]!;
      if (stopOnBrace && c === "}" && depth === 0) return j + 1;
      const next = src[j + 1];
      if (c === "/" && next === "/") {
        while (j < n && src[j] !== "\n") j++;
        continue;
      }
      if (c === "/" && next === "*") {
        const end = src.indexOf("*/", j + 2);
        j = end === -1 ? n : end + 2;
        continue;
      }
      if (c === "/") {
        // 322 X1 (P6): regex-literal branch — see regexLiteralEnd above.
        const end = regexLiteralEnd(src, j);
        if (end !== -1) {
          j = end;
          continue;
        }
      }
      if (c === '"' || c === "'") {
        j = maskQuoted(j);
        continue;
      }
      if (c === "`") {
        j = maskTemplate(j);
        continue;
      }
      if (stopOnBrace) {
        if (c === "{" || c === "(" || c === "[") depth++;
        else if (c === ")" || c === "]") {
          if (depth > 0) depth--;
        } else if (c === "}") depth--;
      }
      out[j] = c;
      j++;
    }
    return j;
  };
  scanCode(0, false);
  return out.join("");
}

/**
 * 346 C3: the surfaced failure carries its machine class. `code` is PRESENT on
 * every `ok:false` envelope (errors.ts registry) and ABSENT on success. NOTE:
 * the `throw new Error(...)` occurrences inside `buildPhase6Module` /
 * `healSource` / `sandboxWorkerSource` are EMITTED PRODUCT / worker-body source,
 * not sandbox machine failures — they stay bare (RT_E_* is the tool's error
 * namespace, and those exact bytes are pinned by checked-in build artifacts).
 * The failures a CALLER sees are these envelopes, and those are coded here.
 */
export type SandboxResult = { ok: boolean; detail: string; code?: ErrorCode };

export function runGenerated(source: string): SandboxResult {
  // Honest sync gate (B-01): the synchronous path is a bounded engine-template
  // runner ONLY. A template module always opens with `const JOBS = [` and
  // defines `test_no_skip`, and every dynamic insert in buildPhase6Module is a
  // JSON-escaped string literal (no loops, no user statements), so execution is
  // bounded by construction. Any other source (LLM output, user code, future
  // generative producers) is refused by the shape check below and gets the
  // actionable runSandboxed() message (string pinned by sandbox.test.ts).
  // Honesty note (E-29): the worker-isolate executor that message names is
  // DEPRECATED as a product path — it cannot run on the Node host (no DOM
  // Worker) and has no product call site, so on the server such source has no
  // executor today (the server-side bounded runner in node-runner.server.ts is
  // bounded, NOT a security sandbox). The message text is retained because the
  // worker route remains the correct browser-side answer when one lands.
  if (!source.startsWith("const JOBS = [") || !source.includes("function test_no_skip")) {
    return { ok: false, detail: "non-template source requires runSandboxed()", code: "RT_E_VALIDATION" };
  }
  // A02: scan code only — engine-injected string literals / comments are prose.
  if (FORBIDDEN.test(maskLiteralsAndComments(source))) {
    return { ok: false, detail: "Forbidden primitive in generated module.", code: "RT_E_VALIDATION" };
  }
  try {
    const body = `${source}\n;if (typeof test_happy === "function") test_happy();\nif (typeof test_no_skip === "function") test_no_skip();`;
    // Isolated function scope — no access to this module's locals besides args.
    const fn = new Function(body);
    fn();
    return { ok: true, detail: "tests.pass" };
  } catch (err) {
    // The generated module's own self-test threw — the sync bounded runner
    // executed and failed (never an input-validation refusal).
    return { ok: false, detail: err instanceof Error ? err.message : String(err), code: "RT_E_RUNNER_FAILED" };
  }
}

export function healSource(source: string, error: string): string {
  if (error.includes("test_happy") && !source.includes("function test_happy")) {
    return `${source}\nfunction test_happy(){ const out = synthesize({ name: "x", phase: 6, job: JOBS[0] }); if (!out.ok) throw new Error("fail"); }\n`;
  }
  return source;
}

// ---------------------------------------------------------------------------
// Engine-authored module builder (B-01 extraction) + honest sandbox claim (B-18)
// ---------------------------------------------------------------------------

export type Phase6ModuleArgs = {
  name: string;
  jobs: string[];
  rejectionNote?: string | null;
  /** 0 = base module (byte-identical to the original P6 template); 1 = adds test_rejection_addressed (T9/R-209 steering). */
  variant?: number;
};

/**
 * Deterministic P0-01 NO-KEY floor module. It validates phase-bookkeeping
 * only — it never implements the brief. A keyed run replaces `generatedSource`
 * via liveP6Synthesis (engine.ts, fixes/97 P0-01 Part B); the `p6-brief-fit`
 * DoD probe fails for this module by construction (its identifiers never
 * carry brief vocabulary).
 */
export function buildPhase6Module(args: Phase6ModuleArgs): string {
  const { name, jobs, rejectionNote } = args;
  const variant = args.variant ?? 0;
  const list = (jobs.length ? jobs : ["core"]).slice(0, 5);
  const job0 = list[0] ?? "core";
  const jobList = list.map((j) => JSON.stringify(j)).join(", ");
  const note = rejectionNote ? JSON.stringify(rejectionNote) : '""';
  const lines = [
    `const JOBS = [${jobList}];`,
    `const REJECTION = ${note};`,
    // 338-2 (W52): the parameter carries an inference-anchoring DEFAULT, not a
    // TS-only `spec: {…}` annotation. These bytes are ALSO executed as plain JS
    // — engine.ts runs the template through runGenerated() → `new Function`,
    // where a type annotation is a SyntaxError. The default object types `spec`
    // (name:string, phase:number, job:string) under the emitted `strict:true`
    // tsconfig's noImplicitAny, so a floor tree is type-clean AND still runs.
    `function synthesize(spec = { name: "", phase: 0, job: "" }) {`,
    `  if (spec.phase < 0 || spec.phase > 12) throw new Error("invalid phase");`,
    `  if (JOBS.indexOf(spec.job) === -1) throw new Error("unknown job");`,
    `  if (REJECTION && spec.phase === 9) throw new Error("deploy blocked until rejection addressed");`,
    `  return { ok: true, name: spec.name, job: spec.job, addressed: REJECTION ? true : false };`,
    `}`,
    `function test_happy() {`,
    `  var out = synthesize({ name: ${JSON.stringify(name)}, phase: 6, job: ${JSON.stringify(job0)} });`,
    `  if (!out.ok) throw new Error("expected ok");`,
    `  if (out.job !== ${JSON.stringify(job0)}) throw new Error("job mismatch");`,
    `}`,
    `function test_no_skip() {`,
    `  var threw = false;`,
    `  try { synthesize({ name: "x", phase: -1, job: ${JSON.stringify(job0)} }); } catch (e) { threw = true; }`,
    `  if (!threw) throw new Error("should reject illegal phase");`,
    `}`,
  ];
  if (variant >= 1) {
    lines.push(
      `function test_rejection_addressed() {`,
      `  var out = synthesize({ name: "x", phase: 6, job: ${JSON.stringify(job0)} });`,
      `  if (REJECTION && !out.addressed) throw new Error("rejection not addressed");`,
      `}`,
    );
  }
  return lines.join("\n");
}

/** One source of truth for what the sandbox really is (packet + P4 artifact text, B-18). */
export function sandboxClaim(s: {
  runtime: string;
  ramMb: number | null;
  timeoutS: number;
}): string {
  if (s.runtime === "worker") {
    return `Worker isolate, ${s.timeoutS}s hard cap, network primitives stubbed (fetch/WebSocket/XHR throw)`;
  }
  return "Engine-template runner (bounded, engine-authored code only)";
}

// ---------------------------------------------------------------------------
// P0-01/P0-02 (fixes/97) brief-vocabulary helpers — pure, deterministic, no
// LLM. briefNounHits feeds the p6-brief-fit DoD probe; briefHasVocabulary
// (via briefTokens + the stoplist) feeds p0-brief-grounded. identifierHits
// counts identifier occurrences in CODE ONLY (literals/comments masked) so
// a noun living purely in a string or comment never counts as an
// implementation.
// ---------------------------------------------------------------------------

/**
 * Words that never count as brief vocabulary for the conformance probes
 * (the fixed stoplist from fixes/97 P0-01 §2.3). \"build\" is deliberately NOT
 * stopped — a brief that says \"build a board\" must show board code.
 */
export const BRIEF_STOPWORDS: ReadonlySet<string> = new Set([
  "app", "tool", "library", "with", "and", "the", "for", "using", "web",
  "simple", "tiny", "basic", "a", "an", "of", "to", "in", "on", "by", "from",
  // fixes/127 (X1/99 §1): the vacuous-4/4 root cause — has/job/is/per passed
  // the stoplist and became "required brief nouns", so vacuous oracle cases
  // referencing has/job satisfied the anti-vacuity gate. English function
  // words + ultra-generic product nouns can never prove brief-faithfulness.
  "has", "have", "had", "is", "are", "was", "were", "be", "been", "being",
  "per", "its", "their", "our", "your", "them", "they", "this", "that",
  "these", "those", "each", "every", "any", "all", "some", "can", "will",
  "should", "must", "would", "could", "into", "onto", "over", "under",
  "through", "between", "during", "after", "before", "about", "then", "than",
  "also", "very", "just", "more", "most", "such", "both", "other", "another",
  "what", "which", "when", "where", "who", "how", "get", "set", "make", "take",
  "give", "keep", "let", "like", "use", "used", "via", "across", "along",
  "within", "without", "out", "off", "up", "down", "yet", "so", "if", "or",
  // Generic product nouns too weak to prove a brief was implemented.
  "job", "jobs", "list", "lists", "flow", "flows", "data", "item", "items",
  "page", "pages", "screen", "screens", "field", "fields", "flag", "feed",
  "form", "forms", "record", "records", "entry", "entries", "user", "users",
  "view", "views", "tab", "tabs", "section", "sections",
]);

/** Split a brief into lowercase word tokens (non-alphanumeric = separator). */
export function briefTokens(brief: string): string[] {
  return (typeof brief === "string" ? brief : "")
    .toLowerCase()
    .split(/[^a-z0-9_-]+/)
    .map((t) => t.replace(/^_+|_+$/g, ""))
    .filter((t) => t.length > 1);
}

/**
 * Brief nouns that COULD become code identifiers: valid JS identifier tokens
 * minus stopwords. `required` is the deduped list the p6-brief-fit probe
 * demands visible in generated source; empty for vocabulary-free briefs.
 */
export function briefNounHits(brief: string): { hits: string[]; required: string[] } {
  const hits: string[] = [];
  for (const t of briefTokens(brief)) {
    if (BRIEF_STOPWORDS.has(t)) continue;
    if (!/^[a-z_$][a-z0-9_$]*$/.test(t)) continue;
    hits.push(t);
  }
  return { hits, required: [...new Set(hits)] };
}

/**
 * Which `required` tokens appear inside code identifiers of `source`
 * (string literals and comments masked out). Sub-identifier matches count:
 * `createBoard` proves the brief noun `board` was implemented.
 */
export function identifierHits(required: string[], source: string): string[] {
  const code = maskLiteralsAndComments(typeof source === "string" ? source : "");
  const identifiers = code.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) ?? [];
  const lowers = identifiers.map((i) => i.toLowerCase());
  const out: string[] = [];
  for (const t of required) {
    // 322 X1 (P6): inflectional tolerance — a brief noun proves implementation
    // through its canonical stem too (`updates` ⇐ …Update…, `publishes` ⇐
    // publishStaticSite). canonicalStem is the repo's single stemmer; guard
    // (stem ≠ noun, ≥4 chars) keeps short stems from matching noise.
    const stem = canonicalStem(t);
    if (lowers.some((i) => i === t || i.includes(t) || (stem !== t && stem.length >= 4 && i.includes(stem)))) out.push(t);
  }
  return out;
}

/**
 * W61 lane C (C14): mask `export … from` / `import … from` clause heads so the
 * NAMES they carry are not read as implementations. A `createBoard` identifier
 * that appears ONLY in `export { createBoard } from "./x.ts"` is a re-export,
 * not a definition — counting it let a tree of pure re-export bridges satisfy
 * p6-arch (FINDINGS O-03). Operates on text ALREADY masked by
 * maskLiteralsAndComments, so every module specifier is spaces and the clause
 * head (`export { … } from` / `import … from`) is matched lexically.
 */
export function maskModuleReexports(maskedCode: string): string {
  return String(maskedCode ?? "")
    .replace(/\bexport\s+(?:\{[^}]*\}|\*)\s*(?:as\s+[A-Za-z_$][A-Za-z0-9_$]*\s*)?\bfrom\b/g, " ")
    .replace(/\bimport\b[^;\n]*?\bfrom\b/g, " ");
}

/**
 * W61 lane C (C14): `identifierHits` for IMPLEMENTATION code — re-export/import
 * clause identifiers are masked first, so a capability is "carried by a tree
 * file" only when a real definition mentions it. Used by dod.archTrace so a
 * dead re-export bridge can never map a capability.
 */
export function implementationIdentifierHits(required: string[], source: string): string[] {
  return identifierHits(required, maskModuleReexports(maskLiteralsAndComments(typeof source === "string" ? source : "")));
}

/**
 * W61 lane C (C1) — the p6-brief-fit CORE-noun calibration (R1 P0-5). The flat
 * 0.35 bar over EVERY non-stopword token treated generic verbs the same as
 * product nouns, so a 2-file hollow tree cleared it while dropping the
 * distinguishing nouns (`office-stock-tracker` v1 passed fit on 2 files and
 * failed only `p6-arch`). The fix partitions the brief's nouns into CORE
 * (grounded product vocabulary) and ADVISORY, and holds the CORE to a high bar
 * — never lowering the flat bar, but measuring the meaningful set.
 *
 * Core = tokens in the project's contract-entity names / lattice jobs /
 * spec-graph capability labels, the brief's H1-heading proper nouns, and its
 * bold (**…**) labels (the entity/feature headings the briefs actually carry).
 * Advisory = the remaining `briefNounHits(brief).required`. Pure + deterministic.
 */
export type BriefNounCoreContext = {
  contracts?: { entities?: { name?: unknown }[] } | null;
  lattice?: { jobs?: unknown[]; entities?: unknown[] } | null;
  specGraph?: { nodes?: { id?: unknown; file?: unknown; purpose?: unknown }[] } | null;
};

/**
 * C1: the product/domain REGISTER — brief tokens that name a business domain
 * object even when they are not contract entities (R1 P0-5 "DOMAIN_TERMS
 * register hits"). Mirrors the CURRENT `engine.ts` `DOMAIN_TERMS` values plus
 * the delivery-kind nouns; `sandbox` cannot import `engine` (engine depends on
 * sandbox), so this is the one maintained copy. `engine.test.ts` pins that every
 * live DOMAIN_TERMS value is present here, so the two cannot silently drift.
 */
export const BRIEF_CORE_REGISTER: ReadonlySet<string> = new Set([
  // engine.DOMAIN_TERMS (verbatim values)
  "crm", "pipeline", "lead", "sales",
  "inventory", "warehouse", "sku", "stock",
  "marketplace", "listing", "buyer", "seller", "storefront", "checkout",
  "agent", "orchestrat", "mcp", "llm", "crew",
  "clinic", "patient", "health", "clinician", "hipaa", "phi", "intake",
  "fleet", "dispatch", "route", "driver", "tech",
  "invoice", "billing", "ledger", "quote", "payments", "expense", "receipt",
  "dashboard", "analytics", "kpi", "report",
  "house", "property", "estate", "showing", "flip", "arv", "rental", "tenant",
  "lease", "landlord", "mortgage", "appraisal", "escrow", "closing", "deed",
  "condo", "duplex", "multifamily", "comps", "beds", "baths", "sqft", "realtor",
  "contractor", "renovation", "renovate", "rehab", "trades", "electrician",
  "plumber", "carpenter", "framing", "drywall", "roofing", "hvac", "permit",
  "subcontractor", "punch", "bid", "material",
  // delivery-kind / surface nouns (engine.DELIVERY_KIND_KEYWORDS + web/retail/mobile)
  "library", "package", "sdk", "npm", "module", "statistics",
  "ui", "dashboard", "board", "desk", "portal",
  "cli", "commandline", "terminal", "script",
  "game", "arcade", "service", "webhook", "worker", "api",
  "website", "site", "marketing", "mobile", "screen", "tab", "page",
  "shop", "retail", "catalogue", "catalog", "menu", "product", "order",
  "price", "enquiry", "alert", "restock", "booking", "shift", "rota",
  "appointment", "calendar", "scheduler", "flower", "florist", "bouquet",
  "bakery", "bread", "delivery",
  // W62 C1-07: the live engine.DOMAIN_TERMS values the register was missing —
  // engine.test.ts now pins that every DOMAIN_TERMS value is present here, so
  // a new domain term cannot silently drift out of the brief-fit core set.
  "landing", "seo", "brand", "content", "blog", "brochure",
  "basket", "cart", "pos", "till", "counter", "shelf",
  "ios", "android", "tablet", "native", "touchscreen", "viewport",
  "one-handed", "tab-bar",
]);

/**
 * fixes/348 (measurement fix): the minimum length of a CORE token. A 1-2 char
 * token can never be a meaningful product identifier (`no`, `mn`, `id`, `ui`);
 * requiring ≥3 keeps the core to words a tree can actually carry. Applied to
 * CORE only — `briefNounHits.required` (the advisory denominator) is unchanged.
 */
export const BRIEF_CORE_MIN_CHARS = 3;

/**
 * fixes/348 (measurement fix): file stems owned by the SCAFFOLD, not by the
 * brief's product. `planSpecGraph` emits structural nodes whose files are the
 * emitter's own modules (`src/ui/console.tsx`, `src/api/routes.ts`,
 * `src/state/store.ts`, `tests/oracle.spec.ts`, `src/domain/<domain>.ts`), and
 * their stems (`console`, `spec`, `oracle`, `routes`, `store`) used to be folded
 * into the core set even though the brief never names them — so the gate demanded
 * the tree carry the harness's own filenames. Excluded here.
 */
export const SCAFFOLD_OWNED_STEMS: ReadonlySet<string> = new Set([
  "console", "oracle", "spec", "routes", "store", "custom_software", "customsoftware",
]);

/**
 * fixes/348 (measurement fix): generic capitalized words that a heading/title
 * capitalizes as prose (`Full Website Redesign`), not as a proper noun / product
 * term. Excluded from the heading proper-noun core so a generic modifier is not
 * measured as if the brief named a product concept.
 */
export const BRIEF_GENERIC_CAPITALS: ReadonlySet<string> = new Set([
  "full", "new", "best", "top", "free", "live", "real", "next", "last", "first",
  "other", "same", "only", "just", "more", "most", "all", "note", "notes", "overview",
]);

/**
 * fixes/348 (measurement fix): function words whose presence marks a bold run as
 * a SENTENCE FRAGMENT (`**no prices anywhere**`) rather than a product label
 * (`**Purchase requests**`). A multi-word bold run containing any of these is not
 * a label and contributes nothing to the core.
 */
export const BRIEF_FRAGMENT_WORDS: ReadonlySet<string> = new Set([
  "no", "not", "never", "none", "nothing", "any", "all", "every", "each",
  "anywhere", "everywhere", "somewhere", "without", "cannot", "here", "there",
  "this", "that", "these", "those", "its", "is", "are", "was", "were", "be",
  "do", "does", "did", "can", "will", "would", "should", "must", "may", "might",
]);

/** Identifier-valid, non-stopword tokens of one raw label (lowercased), ≥3 chars. */
function labelTokens(raw: unknown): string[] {
  const out: string[] = [];
  for (const t of briefTokens(String(raw ?? ""))) {
    if (t.length >= BRIEF_CORE_MIN_CHARS && !BRIEF_STOPWORDS.has(t) && /^[a-z_$][a-z0-9_$]*$/.test(t)) out.push(t);
  }
  return out;
}

/** True when a bold run reads as a sentence fragment, not a product label. */
function isFragmentLabel(raw: string): boolean {
  const text = String(raw ?? "").trim();
  if (!text) return false;
  if (text.length > 60 || /[.!?;:]/.test(text)) return true;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > 1 && words.some((w) => BRIEF_FRAGMENT_WORDS.has(w.toLowerCase()))) return true;
  return false;
}

/** Bold-label tokens: the whole run is dropped when it is a sentence fragment. */
function boldLabelTokens(raw: unknown): string[] {
  const text = String(raw ?? "");
  if (isFragmentLabel(text)) return [];
  return labelTokens(text);
}

/**
 * fixes/348 (measurement fix): every token inside a URL authority / email host
 * (`https://www.bloedows.com/` → www, bloedows, com; `bakery@hbci.com` → hbci,
 * com). A URL may carry real product nouns in its PATH (`menu-breads`), so only
 * the authority is collected — never the path.
 */
function briefHostTokens(brief: string): Set<string> {
  const out = new Set<string>();
  const text = typeof brief === "string" ? brief : "";
  for (const u of text.match(/\b(?:https?:\/\/|www\.)[^\s<>()[\]]+/gi) ?? []) {
    const authority = u.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0] ?? "";
    for (const t of briefTokens(authority)) out.add(t);
  }
  for (const m of text.matchAll(/[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g)) {
    for (const t of briefTokens(m[1] ?? "")) out.add(t);
  }
  return out;
}

/** The file stem of a spec-graph node path, minus EVERY extension (`oracle.spec.ts` → `oracle`). */
function specGraphFileStem(file: string): string {
  return file.replace(/^.*[\\/]/, "").replace(/(\.[^.]+)+$/, "");
}

/**
 * C1: partition a brief's nouns into `core` (grounded product vocabulary) and
 * `advisory` (the rest). When `context` (the project's contracts/lattice/
 * spec-graph) is supplied, its grounded nouns are folded into core — the
 * signal that catches an under-produced tree (a declared job/entity the tree
 * never materialised). Without a context the brief's own H1 proper nouns and
 * bold labels carry the core. Empty when neither yields a noun (vacuity).
 *
 * fixes/348 (measurement fix): the core is the MEANINGFUL product vocabulary —
 * scaffold-owned file stems (`console`/`spec`/`oracle` from the emitter's own
 * modules), URL/email host tokens, sub-3-char tokens, and bold SENTENCE
 * FRAGMENTS are excluded. The bar ({@link BRIEF_FIT_CORE_BAR}) is unchanged and
 * a generic tree still fails: the core remains the brief's real nouns plus the
 * project's declared capabilities.
 */
export function briefNounCore(
  brief: string,
  context?: BriefNounCoreContext | null,
): { core: string[]; advisory: string[] } {
  const { required } = briefNounHits(brief);
  const core = new Set<string>();
  const host = briefHostTokens(brief);
  // The core is filtered once here (fixes/348): scaffold-owned stems, URL/host
  // tokens, and sub-3-char tokens can never be the brief's product vocabulary.
  const add = (raw: unknown) => {
    for (const t of labelTokens(raw)) {
      if (host.has(t) || SCAFFOLD_OWNED_STEMS.has(t)) continue;
      core.add(t);
    }
  };
  if (context && typeof context === "object") {
    for (const e of context.contracts?.entities ?? []) add(e?.name);
    for (const j of context.lattice?.jobs ?? []) add(j);
    // Spec-graph CAPABILITY nodes only: the structural schema/api/store/ui/tests
    // nodes are scaffold-owned (their filenames are the emitter's own modules).
    for (const n of context.specGraph?.nodes ?? []) {
      const id = String(n?.id ?? "");
      if (id === "schema" || id === "api" || id === "store" || id === "ui" || id === "tests") continue;
      const file = String(n?.file ?? "");
      if (file) add(specGraphFileStem(file));
      const m = /[\u201c"]([^\u201d"]+)[\u201d"]/.exec(String(n?.purpose ?? ""));
      if (m) add(m[1]);
    }
  }
  // H1 TITLE proper nouns ONLY (fixes/348): the intro PROSE used to be mined
  // too, so a competitor named mid-sentence (`Crumbl`, `WordPress`) and a
  // sentence-initial verb (`Replace`, `Build`) were measured as core product
  // nouns. A generic capitalized modifier (`Full Website Redesign`) is dropped.
  const h1 = (/^[ \t]*#[ \t]+([^\n]*)$/m.exec(String(brief ?? "")) ?? [])[1] ?? "";
  for (const m of h1.matchAll(/\b[A-Z][a-zA-Z0-9]{2,}\b/g)) {
    if (BRIEF_GENERIC_CAPITALS.has(m[0].toLowerCase())) continue;
    add(m[0]);
  }
  // Bold labels (**Item**, **Staff**, **Purchase requests** …); a bold SENTENCE
  // FRAGMENT (`**no prices anywhere**`) contributes nothing.
  for (const m of String(brief ?? "").matchAll(/\*\*([^*]+)\*\*/g)) {
    for (const t of boldLabelTokens(m[1])) {
      if (host.has(t) || SCAFFOLD_OWNED_STEMS.has(t)) continue;
      core.add(t);
    }
  }
  // Domain-register hits anywhere in the brief (R1 P0-5 core signal (c)). The
  // register is the CURATED product vocabulary (`engine.DOMAIN_TERMS` + the
  // delivery-kind nouns), so an explicit register entry is intentional and is
  // kept as-is — only an URL/host token is never a product noun.
  for (const t of briefTokens(brief)) {
    if (host.has(t)) continue;
    if (BRIEF_CORE_REGISTER.has(t)) core.add(t);
  }
  const coreList = required.filter((t) => core.has(t));
  const coreSet = new Set(core);
  // Core is not limited to `required` — a project-grounded entity/job noun is a
  // core demand even when the brief's prose phrased it differently.
  const grounded = [...core].filter((t) => !BRIEF_STOPWORDS.has(t));
  const merged = [...new Set([...coreList, ...grounded])].sort();
  const advisory = required.filter((t) => !coreSet.has(t));
  return { core: merged, advisory };
}

/** C1: the hard core bar — ≥ ceil(core × 0.6), min 1 (a higher coverage of the
 *  smaller, meaningful set; the advisory 0.35 is diagnostics only). */
export const BRIEF_FIT_CORE_BAR = 0.6;
export function briefFitCoreNeed(coreLength: number): number {
  return Math.max(1, Math.ceil(coreLength * BRIEF_FIT_CORE_BAR));
}

/**
 * C1: the p6-brief-fit coverage over the core/advisory split. `pass` is the
 * hard core bar (vacuously true when the core is empty). Advisory counts are
 * reported for diagnosis only and never flip the verdict.
 */
export function briefFitCoverage(
  brief: string,
  source: string,
  context?: BriefNounCoreContext | null,
): {
  core: string[];
  coreHits: string[];
  missingCore: string[];
  advisory: string[];
  advisoryHits: string[];
  missingAdvisory: string[];
  need: number;
  pass: boolean;
} {
  const src = typeof source === "string" ? source : "";
  // Vacuity FIRST (R1 P0-5 step 4): a brief with NO content vocabulary passes
  // without consulting project grounding — a stopword-only brief never demands
  // identifiers, even though the fallback lattice still has demo jobs/entities.
  const { required } = briefNounHits(brief);
  if (required.length === 0) {
    return {
      core: [],
      coreHits: [],
      missingCore: [],
      advisory: [],
      advisoryHits: [],
      missingAdvisory: [],
      need: 0,
      pass: true,
    };
  }
  const { core, advisory } = briefNounCore(brief, context);
  // A vocabulary-bearing brief always has a measured core: if nothing grounds
  // (no context, no H1/bold/register), fall back to the full required set so
  // the brief is never auto-passed.
  const measured = core.length > 0 ? core : required;
  const coreHits = identifierHits(measured, src);
  const advisoryHits = identifierHits(advisory, src);
  const coreHitSet = new Set(coreHits);
  const advisoryHitSet = new Set(advisoryHits);
  const need = briefFitCoreNeed(measured.length);
  const pass = coreHits.length >= need;
  return {
    core: measured,
    coreHits,
    missingCore: measured.filter((t) => !coreHitSet.has(t)),
    advisory,
    advisoryHits,
    missingAdvisory: advisory.filter((t) => !advisoryHitSet.has(t)),
    need,
    pass,
  };
}

/** C1: the single p6-brief-fit predicate — dod's probe and its state line read
 *  THIS so they can never drift. Vacuity preserved (empty core ⇒ pass). */
export function briefFitSubstancePasses(
  brief: string,
  source: string,
  context?: BriefNounCoreContext | null,
): boolean {
  return briefFitCoverage(brief, source, context).pass;
}

// ---------------------------------------------------------------------------
// Worker-isolate executor (R1/B-01) — DEPRECATED as a product execution path
// (E-29, choice b). It has zero product call sites and cannot run on the Node
// host (no DOM Worker), while all product execution goes through runGenerated
// (engine-template) or the server-side bounded runner (node-runner.server.ts —
// bounded, NOT a security sandbox). The isolate itself is sound and remains
// exercised via injected fakes in sandbox.test.ts, and it stays available to a
// future browser-only consumer; the retired executor-claim wording ("the only
// legal executor for non-template source") overstated what the product can do
// today, so it is gone. The mechanics below are unchanged: a fresh blob Worker
// per run enforces a hard wall-clock cap via terminate();
// fetch/WebSocket/XMLHttpRequest are stubbed to throw inside the worker;
// console.* is captured instead of leaked to the host. Structured-clone-safe
// payloads only ({id, code} in, {id, ok, detail} out).
// ---------------------------------------------------------------------------

export type SandboxWorker = {
  postMessage(d: unknown): void;
  terminate(): void;
  onmessage?: ((e: { data: unknown }) => void) | null;
  /** A14: host-side error surface — worker crash / CSP block / parse failure. */
  onerror?: ((e: unknown) => void) | null;
};

/** Default cap mirrors types.ts `sandbox.timeoutS: 30` — kept config-meaningful (B-01). */
const SANDBOX_DEFAULT_TIMEOUT_MS = 30_000;

let sandboxRunId = 0;

/**
 * Pure worker body (a classic script that runs with `self` as its global, so it
 * can be blob-URL'd into a real Worker or driven by an injected fake in tests).
 * Per message {id, code}: `code` is executed inside a function scope whose
 * `fetch` / `WebSocket` / `XMLHttpRequest` params are throwing stubs and whose
 * `console` param collects log/warn/error lines into an array; test_happy /
 * test_no_skip run when present (same tail as the sync path). Replies are
 * {id, ok, detail}; every error path posts back instead of rethrowing.
 */
export function sandboxWorkerSource(): string {
  return [
    '"use strict";',
    "// R1/B-01 worker isolate: no host scope, network primitives stubbed, console captured.",
    "function networkStub() { throw new Error('network primitives are stubbed in the sandbox worker'); }",
    // CORE-18: parameter shadowing below only stops BARE calls — self.fetch /
    // globalThis.fetch / self.importScripts would otherwise resolve through the
    // scope chain to the blob worker's REAL network stack. Hard-overwrite the
    // global surfaces before any user code runs (writable/configurable false so
    // user code cannot restore them). Best-effort per surface: hosts without
    // defineProperty still get the parameter stubs.
    "function hardStub(name) {",
    "  try {",
    "    Object.defineProperty(self, name, { value: networkStub, writable: false, configurable: false });",
    "  } catch (e) { /* surface not definable — parameter stubs still shadow bare calls */ }",
    "}",
    "['fetch', 'WebSocket', 'XMLHttpRequest', 'EventSource', 'importScripts', 'Worker', 'SharedWorker'].forEach(hardStub);",
    "self.onmessage = function (ev) {",
    "  var msg = ev && ev.data ? ev.data : {};",
    "  var id = msg.id;",
    "  var code = typeof msg.code === 'string' ? msg.code : '';",
    "  var logs = [];",
    "  function capture() { logs.push(Array.prototype.map.call(arguments, String).join(' ')); }",
    "  var sandboxConsole = { log: capture, warn: capture, error: capture };",
    "  function reply(payload) { self.postMessage(payload); }",
    "  try {",
    "    if (code === '') { reply({ id: id, ok: false, detail: 'empty source' }); return; }",
    "    var fn = new Function(",
    "      'fetch', 'WebSocket', 'XMLHttpRequest', 'console',",
    '      code + \'\\n;if (typeof test_happy === \\"function\\") test_happy();\\nif (typeof test_no_skip === \\"function\\") test_no_skip();\'',
    "    );",
    "    fn(networkStub, networkStub, networkStub, sandboxConsole);",
    "    reply({ id: id, ok: true, detail: 'tests.pass' });",
    "  } catch (err) {",
    // CORE-19: captured console output is the only visibility a healer/agent has
    // into a failing run — surface it instead of throwing it away.
    "    var why = err instanceof Error ? err.message : String(err);",
    "    if (logs.length) why = why + ' · console: ' + logs.join(' | ');",
    "    reply({ id: id, ok: false, detail: why });",
    "  }",
    "};",
  ].join("\n");
}

/**
 * @deprecated E-29 (choice b) — no product call site; cannot run on the Node
 * host (no DOM Worker). Retained + tested via injected `workerFactory` fakes;
 * a future browser-only "run snippet in worker isolate" consumer may revive
 * it. Product execution today: runGenerated (sync template) server-side and
 * runCode → runNodeBounded (bounded, NOT a security sandbox).
 *
 * Real async worker-isolate executor: runs `source` in a fresh blob Worker. The worker's
 * onmessage scope shadows fetch/WebSocket/XMLHttpRequest with throwing stubs
 * (network deny is real, not a regex), so an infinite loop is the only way a
 * run can hang — and the terminate() timer kills that too.
 *
 * - Resolves on the reply whose `id` matches the request (stale-worker guard).
 * - `timeoutMs` (default 30000) races worker.terminate(); timeout yields
 *   {ok:false, detail:"killed after <n>s"}.
 * - Worker creation failure (e.g. Node, CSP) => {ok:false, detail:"worker unavailable"}.
 * - Worker onerror (crash before any reply) settles {ok:false, detail:"worker crashed"}
 *   immediately — the timeout stays as a backstop, not the primary signal (A14).
 * - `workerFactory` is injectable so node:test can exercise the full protocol
 *   with a fake worker (Node has no web Worker global).
 */
export async function runSandboxed(
  source: string,
  opts?: { timeoutMs?: number; workerFactory?: (url: string) => SandboxWorker },
): Promise<SandboxResult> {
  const timeoutMs = opts?.timeoutMs ?? SANDBOX_DEFAULT_TIMEOUT_MS;
  const workerFactory =
    opts?.workerFactory ??
    ((url: string): SandboxWorker => {
      if (typeof Worker === "undefined") {
        // Coded (346 C3): the one throw this module executes itself, so a caller
        // reading the caught error still sees the machine class. runSandboxed
        // maps it to the same coded `worker unavailable` envelope below.
        const err = new Error("worker unavailable") as Error & { code: ErrorCode };
        err.code = "RT_E_RUNNER_UNAVAILABLE";
        throw err;
      }
      // Adapter: the DOM Worker's own onmessage is MessageEvent-typed; expose the
      // narrow {data}-shaped surface this module's protocol actually uses.
      const real = new Worker(url);
      const adapted: SandboxWorker = {
        postMessage: (d: unknown) => real.postMessage(d as never),
        terminate: () => real.terminate(),
        onmessage: null,
      };
      real.onmessage = (ev: MessageEvent) => {
        if (adapted.onmessage) adapted.onmessage({ data: ev.data });
      };
      // A14: a worker that dies before replying (CSP block, blob parse failure)
      // surfaces here; forward it so runSandboxed can fail fast + honestly.
      real.onerror = () => {
        if (adapted.onerror) adapted.onerror(new Error("worker error"));
      };
      return adapted;
    });
  if (typeof source !== "string" || source.length === 0) {
    return { ok: false, detail: "empty source", code: "RT_E_VALIDATION" };
  }
  let worker: SandboxWorker | null = null;
  let blobUrl: string | null = null;
  try {
    if (
      typeof URL !== "undefined" &&
      typeof URL.createObjectURL === "function" &&
      typeof Blob !== "undefined"
    ) {
      blobUrl = URL.createObjectURL(new Blob([sandboxWorkerSource()], { type: "text/javascript" }));
    }
    worker = workerFactory(blobUrl ?? "blob:sandbox-worker");
  } catch {
    // 337-3: the URL was created before the factory ran; a throwing factory
    // used to return here without revoking it (blob-URL leak on the failure
    // path). Best-effort, same posture as the settle path below.
    if (blobUrl !== null) {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch {
        // Blob URLs unsupported (odd host) — nothing to revoke.
      }
    }
    return { ok: false, detail: "worker unavailable", code: "RT_E_RUNNER_UNAVAILABLE" };
  }
  const id = ++sandboxRunId;
  const w: SandboxWorker = worker;
  return new Promise<SandboxResult>((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const settle = (result: SandboxResult): void => {
      if (settled) return;
      settled = true;
      if (timer !== null) clearTimeout(timer);
      if (blobUrl !== null) {
        try {
          URL.revokeObjectURL(blobUrl);
        } catch {
          // Blob URLs unsupported (odd host) — nothing to revoke.
        }
      }
      try {
        w.terminate();
      } catch {
        // Worker already gone.
      }
      resolve(result);
    };
    timer = setTimeout(() => {
      settle({ ok: false, detail: `killed after ${timeoutMs / 1000}s`, code: "RT_E_RUNNER_FAILED" });
    }, timeoutMs);
    w.onmessage = (e: { data: unknown }) => {
      const data = e.data as { id?: unknown; ok?: unknown; detail?: unknown } | null;
      if (!data || typeof data !== "object" || data.id !== id) return; // stale-worker guard
      const ok = data.ok === true;
      settle({
        ok,
        detail: typeof data.detail === "string" ? data.detail : "unknown result",
        ...(ok ? {} : { code: "RT_E_RUNNER_FAILED" as const }),
      });
    };
    // A14: dead-before-reply workers (CSP block, blob parse failure) settle
    // fast with an honest message instead of burning the whole timeout.
    w.onerror = () => {
      settle({ ok: false, detail: "worker crashed", code: "RT_E_RUNNER_FAILED" });
    };
    try {
      w.postMessage({ id, code: source });
    } catch {
      settle({ ok: false, detail: "worker unavailable", code: "RT_E_RUNNER_UNAVAILABLE" });
    }
  });
}

// ---------------------------------------------------------------------------
// fixes/152 (factory steal #2 — super-simple-software-factory): POST-HOC CLAIM
// GATES. SSSF's gates verify claims AFTER the fact against typed envelopes
// (artifacts_exist / files_non_empty / diff_matches_claims) instead of trusting
// a phase's self-report. verifyClaims is the pure core: claim rows checked
// against an artifact map (path → content), honest {ok, unmet[]} — absent
// artifacts are unmet, never skipped. Pure + deterministic; the DoD wiring
// lives in dod.ts (p6-arch evidence row class when claims are present).
// ---------------------------------------------------------------------------

export type ClaimRow =
  | { kind: "file-exists"; target: string }
  | { kind: "dir-non-empty"; target: string }
  | { kind: "contains-identifier"; target: string; expect: string };

export function verifyClaims(
  claims: readonly ClaimRow[],
  artifacts: Readonly<Record<string, string>>,
): { ok: boolean; unmet: string[] } {
  const unmet: string[] = [];
  for (const c of Array.isArray(claims) ? claims : []) {
    if (!c || typeof c !== "object" || typeof (c as ClaimRow).kind !== "string") {
      unmet.push("malformed claim row");
      continue;
    }
    if (typeof c.target !== "string" || !c.target) {
      unmet.push(`malformed claim row (no target): ${JSON.stringify(c)}`);
      continue;
    }
    const content = artifacts[c.target];
    switch (c.kind) {
      case "file-exists":
        if (content === undefined) unmet.push(`missing file: ${c.target}`);
        break;
      case "dir-non-empty": {
        const prefix = c.target.endsWith("/") ? c.target : `${c.target}/`;
        const any = Object.keys(artifacts).some((p) => p.startsWith(prefix));
        if (!any) unmet.push(`empty dir: ${c.target}`);
        break;
      }
      case "contains-identifier": {
        // 337-3: `expect` is part of the claim shape the kind requires — a
        // non-string is a malformed row (unmet), never a TypeError out of this
        // function's documented pure/hostile-tolerant contract.
        if (typeof c.expect !== "string") {
          unmet.push(`malformed claim row (no expect): ${JSON.stringify(c)}`);
          break;
        }
        if (content === undefined) {
          unmet.push(`missing file: ${c.target}`);
          break;
        }
        // identifierHits lowercases the source's identifiers — the required
        // token must be lowercase to match (createBoard → createboard).
        if (identifierHits([c.expect.toLowerCase()], content).length === 0) {
          unmet.push(`identifier absent: ${c.expect} in ${c.target}`);
        }
        break;
      }
      default:
        unmet.push(`unknown claim kind: ${JSON.stringify(c)}`);
    }
  }
  return { ok: unmet.length === 0, unmet };
}
