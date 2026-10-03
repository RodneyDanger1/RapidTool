import { canonicalStem } from "./algorithms.ts";

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
const FORBIDDEN =
  /\b(process|require|globalThis|window|self|fetch|WebSocket|XMLHttpRequest|eval|Function|import|document|localStorage|indexedDB)\b/;

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
 * regex-legal keyword (never after an identifier, literal, `)` or `]`).
 */
function regexLiteralEnd(src: string, i: number): number {
  let k = i - 1;
  while (k >= 0 && (src[k] === " " || src[k] === "\t")) k--;
  const prev = k < 0 ? "\n" : src[k];
  const keyword =
    /\b(return|typeof|case|in|of|new|delete|void|instanceof|do|else|yield|await)$/.test(
      src.slice(Math.max(0, k - 12), k + 1),
    );
  if (prev !== "\n" && !"(,=:[!&|?{};+-*%^~<>".includes(prev) && !keyword) return -1;
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
 * Masks string literals ('…', "…", `…` — incl. `${…}` interpolation bodies)
 * and comments (line and block comments) with spaces, so FORBIDDEN scans code tokens only.
 * Replacing with same-length spaces preserves token separation (a string can
 * never weld two code identifiers together into a banned word). Defense note:
 * this lexical mask is not a parser — the denylist is defense-in-depth for the
 * sync engine-template path only. The worker-isolate boundary this comment
 * once pointed to (runSandboxed, "the real boundary for non-template source")
 * is deprecated as a product executor (E-29): the Node host has no DOM Worker
 * and runSandboxed has zero product call sites — see its deprecation note.
 */
/** Masks string literals and comments with spaces (exported for P0-01 brief-fit probes). */
export function maskLiteralsAndComments(src: string): string {
  const n = src.length;
  let out = "";
  let i = 0;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    if (c === "/" && next === "/") {
      while (i < n && src[i] !== "\n") {
        out += " ";
        i++;
      }
      continue;
    }
    if (c === "/" && next === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end === -1 ? n : end + 2;
      out += " ".repeat(stop - i);
      i = stop;
      continue;
    }
    if (c === "/" && next !== "/" && next !== "*") {
      // 322 X1 (P6): regex-literal branch — see regexLiteralEnd above.
      const end = regexLiteralEnd(src, i);
      if (end !== -1) {
        out += " ".repeat(end - i);
        i = end;
        continue;
      }
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      let j = i + 1;
      while (j < n) {
        if (src[j] === "\\") {
          j += 2;
          continue;
        }
        if (src[j] === quote) {
          j++;
          break;
        }
        j++;
      }
      out += " ".repeat(Math.min(j, n) - i);
      i = Math.min(j, n);
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

export type SandboxResult = { ok: boolean; detail: string };

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
    return { ok: false, detail: "non-template source requires runSandboxed()" };
  }
  // A02: scan code only — engine-injected string literals / comments are prose.
  if (FORBIDDEN.test(maskLiteralsAndComments(source))) {
    return { ok: false, detail: "Forbidden primitive in generated module." };
  }
  try {
    const body = `${source}\n;if (typeof test_happy === "function") test_happy();\nif (typeof test_no_skip === "function") test_no_skip();`;
    // Isolated function scope — no access to this module's locals besides args.
    const fn = new Function(body);
    fn();
    return { ok: true, detail: "tests.pass" };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
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
    `function synthesize(spec) {`,
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
      if (typeof Worker === "undefined") throw new Error("worker unavailable");
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
    return { ok: false, detail: "empty source" };
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
    return { ok: false, detail: "worker unavailable" };
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
      settle({ ok: false, detail: `killed after ${timeoutMs / 1000}s` });
    }, timeoutMs);
    w.onmessage = (e: { data: unknown }) => {
      const data = e.data as { id?: unknown; ok?: unknown; detail?: unknown } | null;
      if (!data || typeof data !== "object" || data.id !== id) return; // stale-worker guard
      settle({
        ok: data.ok === true,
        detail: typeof data.detail === "string" ? data.detail : "unknown result",
      });
    };
    // A14: dead-before-reply workers (CSP block, blob parse failure) settle
    // fast with an honest message instead of burning the whole timeout.
    w.onerror = () => {
      settle({ ok: false, detail: "worker crashed" });
    };
    try {
      w.postMessage({ id, code: source });
    } catch {
      settle({ ok: false, detail: "worker unavailable" });
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
