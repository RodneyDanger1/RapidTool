// ---------------------------------------------------------------------------
// arch-tools.ts — architecture surface on REAL generated code (G-30-narrow +
// G-32, wave 3). Pure, keyless, deterministic, zero dependencies (and zero
// imports — this module is self-contained by construction).
//
// The feasibility review (research/multiagent/15_feasibility_review.md)
// corrected G-30/G-31: dependency-cruiser/madge need graphviz for visuals and
// a temp-dir materialization for files; the fix is a hand-rolled import
// scanner over the emitted file strings (they are deterministic TS, and
// relative `./x.ts` imports are trivial to extract). dependencyGraph() is
// that scanner; codebaseMap() is the G-33-flavoured artifact/scaffold map
// without the ts-morph dependency; adrRecord() is the G-32 machine-minted
// decision-record body (pattern from npryce/adr-tools — pattern only, no code
// copied; phodal/adr MIT is the reference format).
//
// Honesty contract: nothing here calls an LLM, reads the filesystem, or
// fabricates structure. The scanner reports only what the text provably
// contains: relative-import edges between provided files, resolved through
// `./` and `../`; bare specifiers (react, node:fs, @/aliases) are OUT of scope
// and reported as nothing (the register scopes the rule set to relative
// edges).
// ---------------------------------------------------------------------------

export type ScaffoldFileLike = { path: string; body: string };

export type DepNode = { id: string; path: string };
export type DepEdge = { from: string; to: string };

export type DependencyGraph = { nodes: DepNode[]; edges: DepEdge[] };

/** One string-literal import found in code position: `from "./x"`, `import("./x")`, `require("./x")`. */
export type LocalImportRef = { spec: string; line: number };

// ---------------------------------------------------------------------------
// Import scanner (mini-lexer)
//
// Walks the body char-by-char tracking comment/string/template/regex state.
// Only string literals that IMMEDIATELY follow `from`, `import(`, or
// `require(` in real code are candidates; the spec must start with `./` or
// `../` to be reported. Comments, template-literal content, and regex
// literals never produce refs (a `/…/` literal containing `from "./x"` is
// not an import). Member-call lookalikes (`obj.from("./x")`, `x.import(…)`)
// are excluded by the tail rule (`.` before the marker is not a code
// boundary). Side-effect `import "./x"` (no `from`, no parens) is out of
// scope by design. Heuristic limits (documented): dynamic import() inside a
// template `${...}` and `require(` + template literal are not detected; a
// standalone function literally named `from` called with a relative first
// argument would false-positive.
// ---------------------------------------------------------------------------

const IMPORT_TAIL_RE = /(?:^|[^\w$.])(?:from|import\(|require\()$/;

/** Chars after which a `/` starts a regex literal rather than division. */
const REGEX_PRECEDERS = new Set([
  "=", ":", ",", "(", "[", "{", "!", "&", "|", "?", ";", "+", "-", "*", "%", "^", "~", "<", ">", "/",
]);

export function scanLocalImports(body: string): LocalImportRef[] {
  const refs: LocalImportRef[] = [];
  const n = body.length;
  let i = 0;
  let line = 1;
  let codeTail = ""; // last ~40 raw code chars (whitespace kept) — drives marker checks
  while (i < n) {
    const c = body[i];
    const next = i + 1 < n ? body[i + 1] : "";
    if (c === "\n") {
      line++;
      codeTail = (codeTail + c).slice(-40);
      i++;
      continue;
    }
    if (c === "/" && next === "/") {
      i += 2;
      while (i < n && body[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < n && !(body[i] === "*" && i + 1 < n && body[i + 1] === "/")) {
        if (body[i] === "\n") line++;
        i++;
      }
      i = Math.min(n, i + 2);
      continue;
    }
    if (c === "/") {
      // Regex-literal branch (heuristic, mirrors maskNonCode): a `/` in a
      // value position opens a regex literal whose content must never be
      // scanned — `/from ".\/ghost.ts"/` is a literal, not an import. Confirm
      // an unescaped closing `/` before end-of-line; otherwise it was
      // division and falls through as plain code.
      const tailTrimmed = codeTail.trimEnd();
      const prev = tailTrimmed.length > 0 ? tailTrimmed[tailTrimmed.length - 1] : "";
      const afterValueWord = /\b(?:return|typeof|instanceof|in|of|case|do|else|yield|await|throw|delete|void)$/.test(
        tailTrimmed,
      );
      const startsRegex =
        prev === "" || REGEX_PRECEDERS.has(prev) || (/\w/.test(prev) && afterValueWord);
      if (startsRegex) {
        let j = i + 1;
        let closed = false;
        while (j < n) {
          const ch = body[j];
          if (ch === "\\") {
            if (body[j + 1] === "\n") line++; // escaped line terminator inside a literal
            j += 2;
            continue;
          }
          if (ch === "\n") break;
          if (ch === "/") {
            closed = true;
            break;
          }
          j++;
        }
        if (closed) {
          i = j + 1;
          // Skip literal flags (`/x/gi`) — content and flags stay unscanned.
          while (i < n && /[a-z]/i.test(body[i])) i++;
          continue;
        }
      }
    }
    if (c === "`") {
      // Template literal: consume whole (incl. ${...}); content never scanned.
      i++;
      while (i < n) {
        const ch = body[i];
        if (ch === "\\") {
          if (body[i + 1] === "\n") line++; // escaped line terminator continues the line
          i += 2;
          continue;
        }
        if (ch === "\n") line++;
        if (ch === "`") {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    if (c === "'" || c === '"') {
      const quote = c;
      const tailTrimmed = codeTail.trimEnd();
      const isImportSpecifierPos = IMPORT_TAIL_RE.test(tailTrimmed);
      // Consume the literal, decoding escapes, and capture content.
      let content = "";
      i++;
      let closed = false;
      while (i < n) {
        const ch = body[i];
        if (ch === "\\") {
          if (body[i + 1] === "\n") line++; // `\` + real newline: line continuation
          content += body[i + 1] ?? "";
          i += 2;
          continue;
        }
        if (ch === quote) {
          closed = true;
          i++;
          break;
        }
        if (ch === "\n") line++;
        content += ch;
        i++;
      }
      if (isImportSpecifierPos && closed && (content.startsWith("./") || content.startsWith("../"))) {
        refs.push({ spec: content, line });
      }
      codeTail = (codeTail + `"${content}"`).slice(-40);
      continue;
    }
    codeTail = (codeTail + c).slice(-40);
    i++;
  }
  return refs;
}

// ---------------------------------------------------------------------------
// Module-id canonicalization + relative resolution
// ---------------------------------------------------------------------------

const TS_EXT_RE = /\.(?:d\.)?(?:ts|tsx|js|jsx|mjs|cjs|mts|cts)$/i;

/** Normalize a path to a canonical module id: forward slashes, no leading `./`, no TS/JS extension. */
export function canonicalModuleId(path: string): string {
  if (typeof path !== "string") return ""; // junk rows fail closed (no crash, no id)
  let p = path.replace(/\\/g, "/").trim();
  while (p.startsWith("./")) p = p.slice(2);
  p = p.replace(TS_EXT_RE, "");
  return p;
}

/** Resolve a relative spec against the importing file's own path. */
export function resolveRelativeImport(fromPath: string, spec: string): string {
  if (typeof spec !== "string") return "";
  const dir =
    typeof fromPath === "string" && fromPath.includes("/")
      ? fromPath.slice(0, fromPath.lastIndexOf("/"))
      : "";
  const joined = dir.length > 0 ? `${dir}/${spec}` : spec;
  const parts = joined.split("/");
  const stack: string[] = [];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (stack.length > 0) stack.pop();
      continue;
    }
    stack.push(part);
  }
  return canonicalModuleId(stack.join("/"));
}

// ---------------------------------------------------------------------------
// dependencyGraph (G-30-narrow)
// ---------------------------------------------------------------------------

export function dependencyGraph(files: ScaffoldFileLike[]): DependencyGraph {
  // Junk rows fail closed (mirrors mineCodebase's stance): rows without a
  // string path are skipped, never allowed to crash the graph builder.
  const rows = (Array.isArray(files) ? files : []).filter(
    (f): f is ScaffoldFileLike =>
      f !== null && typeof f === "object" && typeof (f as { path?: unknown }).path === "string",
  );
  const nodeById = new Map<string, DepNode>();
  for (const f of rows) {
    const id = canonicalModuleId(f.path);
    if (!nodeById.has(id)) nodeById.set(id, { id, path: f.path });
  }
  const seen = new Set<string>();
  const edges: DepEdge[] = [];
  for (const f of rows) {
    const from = canonicalModuleId(f.path);
    for (const ref of scanLocalImports(typeof f.body === "string" ? f.body : "")) {
      const to = resolveRelativeImport(f.path, ref.spec);
      if (to === from) continue; // self-imports are not edges
      const key = `${from}\u0000${to}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from, to });
    }
  }
  edges.sort((a, b) => (a.from === b.from ? (a.to < b.to ? -1 : a.to > b.to ? 1 : 0) : a.from < b.from ? -1 : 1));
  const nodes = [...nodeById.values()];
  nodes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// adrRecord (G-32) — pure markdown ADR body
// ---------------------------------------------------------------------------

/**
 * Build an ADR markdown body (title / Context / Decision / Consequences).
 * Deterministic: no dates, ids or hashes — numbering and file naming are the
 * caller's job (the G-32 CLI/headless layer). `consequences` may be one line
 * or newline-separated; each non-empty line becomes a bullet.
 * Throws TypeError on empty title/context/decision (usage errors).
 */
export function adrRecord(title: string, context: string, decision: string, consequences: string): string {
  const t = title.trim();
  const c = context.trim();
  const d = decision.trim();
  if (!t) throw new TypeError("adrRecord: title must be non-empty");
  if (!c) throw new TypeError("adrRecord: context must be non-empty");
  if (!d) throw new TypeError("adrRecord: decision must be non-empty");
  const bullets = consequences
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `- ${l}`);
  const consequenceLines = bullets.length > 0 ? bullets : ["- (none recorded)"];
  return ["# " + t, "", "## Context", "", c, "", "## Decision", "", d, "", "## Consequences", "", ...consequenceLines, ""].join("\n");
}

// ---------------------------------------------------------------------------
// codebaseMap (G-33-narrow) — deterministic markdown map of artifacts +
// scaffold files, from an in-memory project (C-1: no server filesystem).
// A full Project (types.ts) is structurally compatible with CodebaseInput.
// ---------------------------------------------------------------------------

export type ArtifactLike = {
  id: string;
  phase?: number;
  kind?: string;
  title: string;
  body?: string;
  language?: string;
};

export type CodebaseInput = {
  name?: string;
  brief?: string;
  kind?: string;
  domain?: string;
  artifacts?: ArtifactLike[];
  generatedSource?: string;
  scaffoldFiles?: ScaffoldFileLike[];
};

function escapeCell(value: unknown): string {
  // Junk cells (missing id/title/kind on hand-built rows) coerce to "" —
  // markdown tables never crash over corrupt rows.
  const s = typeof value === "string" ? value : "";
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function lineCount(body: unknown): number {
  if (typeof body !== "string" || body === "") return 0;
  // Lines, counting a trailing newline as terminating the last line (wc-style):
  // "x" -> 1, "x\n" -> 1, "x\ny\n" -> 2, "" -> 0.
  let lines = 1;
  for (const ch of body) {
    if (ch === "\n") lines++;
  }
  return body.endsWith("\n") ? lines - 1 : lines;
}

/** Markdown map over artifacts + scaffold files. Deterministic: same input -> same bytes. */
export function codebaseMap(project: CodebaseInput): string {
  // Corrupt/junk project rows fail closed (never a crash): non-object input,
  // missing arrays and junk row fields coerce to empty / are skipped, so a
  // hand-edited or hostile shape still yields a deterministic map.
  const p = project !== null && typeof project === "object" ? (project as Record<string, unknown>) : {};
  const name = (typeof p.name === "string" ? p.name.trim() : "") || "(unnamed project)";
  const out: string[] = [`# Codebase map — ${escapeCell(name)}`, ""];
  const meta: string[] = [];
  if (typeof p.kind === "string" && p.kind.trim()) meta.push(`kind: ${p.kind.trim()}`);
  if (typeof p.domain === "string" && p.domain.trim()) meta.push(`domain: ${p.domain.trim()}`);
  if (typeof p.brief === "string" && p.brief.trim()) {
    meta.push(`brief: ${p.brief.replace(/\s+/g, " ").trim().slice(0, 140)}`);
  }
  if (meta.length > 0) {
    out.push(`_${escapeCell(meta.join(" · "))}_`, "");
  }

  const artifacts = (Array.isArray(p.artifacts) ? p.artifacts : []).filter(
    (a): a is ArtifactLike => a !== null && typeof a === "object",
  );
  if (artifacts.length > 0) {
    const sorted = [...artifacts].sort((a, b) => {
      const pa = typeof a.phase === "number" && Number.isFinite(a.phase) ? a.phase : Number.MAX_SAFE_INTEGER;
      const pb = typeof b.phase === "number" && Number.isFinite(b.phase) ? b.phase : Number.MAX_SAFE_INTEGER;
      if (pa !== pb) return pa - pb;
      const ia = typeof a.id === "string" ? a.id : "";
      const ib = typeof b.id === "string" ? b.id : "";
      return ia < ib ? -1 : ia > ib ? 1 : 0;
    });
    out.push(`## Artifacts (${sorted.length})`, "", "| id | phase | kind | title | loc | language |", "|---|---|---|---|---|---|");
    for (const a of sorted) {
      const phaseCell = typeof a.phase === "number" && Number.isFinite(a.phase) ? String(a.phase) : "";
      out.push(
        `| ${escapeCell(a.id)} | ${phaseCell} | ${escapeCell(a.kind)} | ${escapeCell(a.title)} | ${lineCount(a.body)} | ${escapeCell(a.language)} |`,
      );
    }
    out.push("");
  }

  const generated = typeof p.generatedSource === "string" ? p.generatedSource : "";
  if (generated.trim().length > 0) {
    out.push(`## Generated source module`, "", `- \`generatedSource\` — ${lineCount(generated)} LOC`, "");
  }

  const files = (Array.isArray(p.scaffoldFiles) ? p.scaffoldFiles : []).filter(
    (f): f is ScaffoldFileLike =>
      f !== null && typeof f === "object" && typeof (f as { path?: unknown }).path === "string",
  );
  if (files.length > 0) {
    const sorted = [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    out.push(`## Scaffold files (${sorted.length})`, "", "| path | loc | local imports |", "|---|---|---|");
    for (const f of sorted) {
      const imports = scanLocalImports(typeof f.body === "string" ? f.body : "")
        .map((ref) => resolveRelativeImport(f.path, ref.spec))
        .filter((to, idx, arr) => to !== canonicalModuleId(f.path) && arr.indexOf(to) === idx)
        .sort();
      out.push(`| ${escapeCell(f.path)} | ${lineCount(f.body)} | ${escapeCell(imports.join(", "))} |`);
    }
    out.push("");
  }

  return out.join("\n");
}
