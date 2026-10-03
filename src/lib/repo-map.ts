// ---------------------------------------------------------------------------
// repo-map.ts — 343-2 (W57): the deterministic repo map.
//
// A compact, ranked outline of a set of source files (`path: exported symbols`),
// built under a hard char budget with an explicit elision marker. It is the
// context-assembly primitive this repo lacked: the P6 synthesis prompt and the
// Agent Packet both hand the model raw bytes / path lists, while Aider-class
// harnesses hand it a graph-ranked map under a token budget
// (research/multiagent/107_competitors_agentic.md:74; 90_LEAPFROG.md:81-83,707).
//
// DETERMINISTIC + PURE. No clock, no RNG, no IO, no dependency. Identical input
// sets produce deep-equal output regardless of input ORDER (files are deduped by
// normalized path and re-sorted), so the map can be diffed across commits.
//
// CLIENT-SAFE. This module is imported by packet.ts (and console.tsx), both in
// the client graph (console → store → engine → packet). So it may not import
// `node:*`, and it may not import `algo-tools.ts` (whose static imports of
// deepseek.server/verify.server are denied to the client bundle by the TanStack
// import-protection plugin — see server-spec.ts:5-13). It therefore reuses the
// two CLIENT-SAFE repo helpers that do the hard parts:
//   - `maskLiteralsAndComments` (sandbox.ts:85) blanks strings/comments/regex
//     with same-length spaces, so prose can never forge an export name;
//   - `isReexportOnlySource` (dod.ts:264) detects barrel files.
// The export inventory below mirrors the semantics of `exportedNamesOf`
// (algo-tools.ts:484) — runtime names only, types excluded — over the masked
// view. A name is reported ONLY when an explicit export form binds it in the
// real bytes; nothing is guessed.
//
// HONEST SCOPE: like ast-mine.ts, this is LEXICAL extraction, not a parser. It
// understands the export shapes this codebase writes; exotic layouts are missed,
// never invented.
// ---------------------------------------------------------------------------
import { maskLiteralsAndComments } from "./sandbox.ts";
import { isReexportOnlySource } from "./dod.ts";

/** One input file: a repo-relative path and its full source. */
export interface RepoMapFile {
  path: string;
  source: string;
}

/** The structural role of a file in the tree. */
export type RepoMapRole = "entry" | "barrel" | "module";

/** One ranked file in the outline. */
export interface RepoMapEntry {
  /** POSIX-normalized path. */
  path: string;
  /** Exported runtime names shown (a prefix of the file's real exports). */
  symbols: string[];
  /** Total exported runtime names found in the bytes. */
  symbolCount: number;
  /** Exported names not shown because of the per-file cap (`symbolCount - symbols.length`). */
  hidden: number;
  /** Distinct in-tree files that import this one (dependency in-degree). */
  inbound: number;
  /** Line count (0 for an empty file). */
  lines: number;
  role: RepoMapRole;
  /** The documented ranking score (integer). */
  score: number;
}

/** The built map: the shown entries plus the budget/elision accounting. */
export interface RepoMap {
  /** Only the entries that fit the budget (a ranked prefix of all files). */
  entries: RepoMapEntry[];
  /** Every valid input file (shown + omitted). */
  totalFiles: number;
  /** `entries.length`. */
  shownFiles: number;
  /** Files omitted by the budget. */
  omitted: number;
  /** `omitted > 0`. */
  truncated: boolean;
  /** The effective char budget (clamped to `REPO_MAP_MIN_BUDGET`). */
  budget: number;
  /** `rendered.length` — always ≤ `budget`. */
  chars: number;
  /** The compact outline. Empty string when there are no files. */
  rendered: string;
  /** True when no valid file was supplied (an honest empty state). */
  empty: boolean;
}

/** Default char budget for a map rendered into a packet section or a pane. */
export const REPO_MAP_DEFAULT_BUDGET = 1_600;
/** Floor so the elision marker itself always fits (marker length is ~≤90). */
export const REPO_MAP_MIN_BUDGET = 200;
/** Default per-file symbol cap (the remainder is reported as `(+N)`). */
export const REPO_MAP_DEFAULT_SYMBOLS = 6;
/** The emitter's fixed generated-source host path when only the legacy single module exists. */
export const REPO_MAP_ENTRY_PATH = "src/generated.ts";
/** The stable prefix of the elision marker (mirrored by tests and the UI). */
export const REPO_MAP_ELISION_PREFIX = "…[repo map elided —";

/** The visible elision marker: names the omitted count and the budget. */
export function repoMapElisionMarker(omitted: number, budget: number): string {
  return `${REPO_MAP_ELISION_PREFIX} ${omitted} file(s) omitted to fit the ${budget}-char budget]`;
}

// --- path helpers (POSIX, dependency-free — no node:path in the client graph) ---

/** POSIX-normalize: `\\`→`/`, drop `.` segments, resolve `..`. */
function normPosix(p: string): string {
  const raw = String(p).replace(/\\/g, "/");
  const abs = raw.startsWith("/");
  const parts: string[] = [];
  for (const seg of raw.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (parts.length > 0 && parts[parts.length - 1] !== "..") parts.pop();
      else if (!abs) parts.push("..");
    } else parts.push(seg);
  }
  return (abs ? "/" : "") + parts.join("/");
}

function dirOf(p: string): string {
  const i = p.lastIndexOf("/");
  return i <= 0 ? "" : p.slice(0, i);
}

/** POSIX join where an empty dir leaves the relative path untouched. */
function joinPosix(dir: string, rel: string): string {
  return dir ? `${dir}/${rel}` : rel;
}

const LOCAL_SPEC = /^(?:\.\.?\/|@\/)/;

/** Resolve a local import specifier against the known file set (extension index forms included). */
function resolveLocal(spec: string, fromPath: string, known: Set<string>): string | null {
  const base = spec.startsWith("@/")
    ? normPosix(`src/${spec.slice(2)}`)
    : normPosix(joinPosix(dirOf(fromPath), spec));
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    `${base}.json`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
    `${base}/index.js`,
  ];
  for (const c of candidates) if (known.has(c)) return c;
  return null;
}

// --- export inventory (client-safe; mirrors exportedNamesOf's runtime semantics) ---

const ID_START = /[A-Za-z_$]/;
const ID_CHAR = /[A-Za-z0-9_$]/;

function skipWs(s: string, i: number): number {
  while (i < s.length && /\s/.test(s[i]!)) i++;
  return i;
}

function readIdent(s: string, i: number): { name: string; end: number } | null {
  if (i >= s.length || !ID_START.test(s[i]!)) return null;
  let j = i + 1;
  while (j < s.length && ID_CHAR.test(s[j]!)) j++;
  return { name: s.slice(i, j), end: j };
}

/** Skip a balanced `(...)`/`[...]`/`{...}` group starting at `i`. */
function skipBalanced(s: string, i: number): number {
  const open = s[i];
  const close = open === "(" ? ")" : open === "[" ? "]" : open === "{" ? "}" : "";
  if (!close) return i;
  let depth = 0;
  for (; i < s.length; i++) {
    if (s[i] === open) depth++;
    else if (s[i] === close) {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return s.length;
}

/** Collect the names a `{…}` / `[…]` binding pattern at `i` binds. */
function collectPatternNames(s: string, i: number, out: string[]): number {
  const close = s[i] === "{" ? "}" : "]";
  i++;
  for (;;) {
    i = skipWs(s, i);
    if (i >= s.length) return i;
    const c = s[i]!;
    if (c === close) return i + 1;
    if (c === ",") {
      i++;
      continue;
    }
    if (c === "." && s.startsWith("...", i)) {
      const rest = readIdent(s, i + 3);
      if (rest) {
        out.push(rest.name);
        i = rest.end;
      } else i += 3;
    } else if (c === "[") {
      i = skipBalanced(s, i); // computed key — binds no name
    } else if (c === "{") {
      i = collectPatternNames(s, i, out);
    } else {
      const id = readIdent(s, i);
      if (id === null) {
        i++;
        continue;
      }
      i = skipWs(s, id.end);
      if (s[i] === ":") {
        i = skipWs(s, i + 1);
        if (s[i] === "{") i = collectPatternNames(s, i, out);
        else {
          const target = readIdent(s, i);
          if (target) {
            out.push(target.name);
            i = target.end;
          }
        }
      } else {
        out.push(id.name); // shorthand (optionally with a default)
      }
    }
    // Skip a `= default` up to the next top-level `,` or the enclosing closer.
    i = skipWs(s, i);
    if (s[i] === "=") {
      i++;
      let depth = 0;
      while (i < s.length) {
        const d = s[i]!;
        if (d === "(" || d === "[" || d === "{") depth++;
        else if (d === ")" || d === "]" || d === "}") {
          if (depth === 0) break;
          depth--;
        } else if (depth === 0 && d === ",") break;
        i++;
      }
    }
  }
}

/** Skip a declarator's `= <expr>` up to the next top-level `,`/`;` (or the closer). */
function skipInitializer(s: string, i: number): number {
  i = skipWs(s, i);
  if (s[i] === "?" || s[i] === "!") i = skipWs(s, i + 1);
  if (s[i] !== "=") return i;
  i++;
  let depth = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      if (depth === 0) break;
      depth--;
    } else if (depth === 0 && (c === "," || c === ";")) break;
    i++;
  }
  return i;
}

/** Names bound by an `export const|let|var` declarator list (multi-declarator + destructuring). */
function declaratorNames(s: string, start: number): string[] {
  const out: string[] = [];
  let i = start;
  for (;;) {
    i = skipWs(s, i);
    if (i >= s.length) break;
    const before = i;
    if (s[i] === "{" || s[i] === "[") i = collectPatternNames(s, i, out);
    else {
      const id = readIdent(s, i);
      if (id === null) break;
      out.push(id.name);
      i = id.end;
    }
    if (i === before) break;
    i = skipInitializer(s, i);
    i = skipWs(s, i);
    if (s[i] === ",") {
      i++;
      continue;
    }
    break;
  }
  return out;
}

/**
 * The runtime names a module source exports, sorted and deduped. Strings,
 * comments and regex literals are masked first, so prose can never forge a name.
 * Types (`export interface`/`export type`) are excluded — matching
 * `exportedNamesOf`'s runtime-name semantics. Deterministic.
 */
export function runtimeExportNamesOf(source: string): string[] {
  if (typeof source !== "string" || source.length === 0) return [];
  const masked = maskLiteralsAndComments(source);
  const names = new Set<string>();

  // CommonJS assigns — member-chain tails (`obj.exports.x`) are excluded by the
  // leading boundary, the same discipline algo-tools.ts:499-506 uses.
  for (const m of masked.matchAll(
    /(^|[^A-Za-z0-9_$.])(?:module\.)?exports\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=(?!=)/g,
  )) {
    names.add(m[2]!);
  }
  // ESM function / class declarations.
  for (const m of masked.matchAll(
    /\bexport\s+(?:async\s+)?(?:function(?:\s*\*\s*|\s+)|(?:abstract\s+)?class\s+)([A-Za-z_$][A-Za-z0-9_$]*)/g,
  )) {
    names.add(m[1]!);
  }
  // ESM const/let/var declarator lists.
  for (const m of masked.matchAll(/\bexport\s+(?:const|let|var)\s+/g)) {
    for (const n of declaratorNames(masked, (m.index ?? 0) + m[0].length)) names.add(n);
  }
  // ESM export lists (`export { a, b as c }`); `export type { … }` never matches
  // because `type` sits between `export` and `{`.
  for (const m of masked.matchAll(/\bexport\s*\{([^}]*)\}/g)) {
    for (const part of m[1]!.split(",")) {
      const seg = part.trim();
      if (!seg || /^type\s/.test(seg)) continue;
      const as = /\bas\s+([A-Za-z_$][A-Za-z0-9_$]*)$/.exec(seg);
      if (as !== null) {
        names.add(as[1]!);
        continue;
      }
      const local = readIdent(seg, 0);
      if (local !== null) names.add(local.name);
    }
  }
  // `export * as ns from "…"` — the one statically knowable star form.
  for (const m of masked.matchAll(
    /\bexport\s*\*\s*as\s+([A-Za-z_$][A-Za-z0-9_$]*)\s+from\b/g,
  )) {
    names.add(m[1]!);
  }
  // Named `export default function|class`.
  for (const m of masked.matchAll(
    /\bexport\s+default\s+(?:async\s+)?(?:function|class)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g,
  )) {
    names.add(m[1]!);
  }
  return [...names].sort();
}

// --- import extraction (specifiers live in strings, so read them from the RAW
//     source at the positions the MASKED view proves are real code) -------------

function readQuotedAt(source: string, i: number): string | null {
  let k = i;
  while (k < source.length && /\s/.test(source[k]!)) k++;
  const q = source[k];
  if (q !== '"' && q !== "'") return null;
  let j = k + 1;
  while (j < source.length && source[j] !== q) {
    if (source[j] === "\\") j += 2;
    else j++;
  }
  if (j >= source.length) return null;
  return source.slice(k + 1, j);
}

function importSpecifiers(masked: string, source: string): string[] {
  const out = new Set<string>();
  for (const m of masked.matchAll(/\bfrom\b/g)) {
    const spec = readQuotedAt(source, (m.index ?? 0) + m[0].length);
    if (spec !== null && spec !== "") out.add(spec);
  }
  for (const m of masked.matchAll(/\bimport\b/g)) {
    let k = (m.index ?? 0) + m[0].length;
    while (k < source.length && /\s/.test(source[k]!)) k++;
    if (source[k] === "(") k++;
    const spec = readQuotedAt(source, k);
    if (spec !== null && spec !== "") out.add(spec);
  }
  return [...out];
}

// --- build -------------------------------------------------------------------

function roleOf(path: string, source: string, entryPath: string): RepoMapRole {
  if (path === entryPath) return "entry";
  const base = path.slice(path.lastIndexOf("/") + 1);
  if (/^(?:index|main|app)\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(base)) return "entry";
  if (isReexportOnlySource(source)) return "barrel";
  return "module";
}

/**
 * Ranking (documented, integer, testable):
 *   score = inbound*10 + exports*5 + floor(min(lines,300)/10) + roleBonus
 * where roleBonus is 60 for the entry (the continuing agent's first read) and
 * 30 for a re-export barrel, else 0. Ties break by path ascending.
 * In-degree and exported surface are the importance signals; size is a capped
 * minor term so one huge file cannot dominate.
 */
const REPO_MAP_WEIGHTS = { inbound: 10, exports: 5, entryBonus: 60, barrelBonus: 30 } as const;

function scoreOf(e: Omit<RepoMapEntry, "score">): number {
  const sizeTerm = Math.floor(Math.min(e.lines, 300) / 10);
  const roleBonus =
    e.role === "entry"
      ? REPO_MAP_WEIGHTS.entryBonus
      : e.role === "barrel"
        ? REPO_MAP_WEIGHTS.barrelBonus
        : 0;
  return e.inbound * REPO_MAP_WEIGHTS.inbound + e.symbolCount * REPO_MAP_WEIGHTS.exports + sizeTerm + roleBonus;
}

function entryLine(e: RepoMapEntry): string {
  const syms =
    e.symbols.length > 0
      ? `${e.symbols.join(", ")}${e.hidden > 0 ? ` (+${e.hidden})` : ""}`
      : "(no named exports)";
  const role = e.role === "module" ? "" : ` · ${e.role}`;
  return `${e.path}: ${syms} · in ${e.inbound}, ${e.lines} ln${role}`;
}

/**
 * buildRepoMap — the ranked, budgeted outline of `files`. Pure and deterministic;
 * input order does not matter (files are deduped by normalized path, keeping the
 * lexicographically smallest raw path/source, then re-sorted). Never throws on
 * junk rows (non-objects / non-string path or source are skipped).
 */
export function buildRepoMap(
  files: readonly RepoMapFile[],
  opts?: { budget?: number; symbolsPerFile?: number; entry?: string },
): RepoMap {
  const budget = Math.max(
    REPO_MAP_MIN_BUDGET,
    Math.floor(Number.isFinite(opts?.budget) ? (opts!.budget as number) : REPO_MAP_DEFAULT_BUDGET),
  );
  const symbolsPerFile = Math.max(
    0,
    Math.floor(
      Number.isFinite(opts?.symbolsPerFile)
        ? (opts!.symbolsPerFile as number)
        : REPO_MAP_DEFAULT_SYMBOLS,
    ),
  );
  const entryPath = normPosix(opts?.entry ?? REPO_MAP_ENTRY_PATH);

  // Dedupe by normalized path, else order-dependent: keep the lexicographically
  // smallest (raw path, source) so reordered inputs stay deep-equal.
  const byPath = new Map<string, { raw: string; source: string }>();
  const input = Array.isArray(files) ? files : [];
  for (const f of input) {
    if (!f || typeof f !== "object") continue;
    const rawPath = (f as { path?: unknown }).path;
    const source = (f as { source?: unknown }).source;
    if (typeof rawPath !== "string" || typeof source !== "string") continue;
    const norm = normPosix(rawPath);
    if (norm === "") continue;
    const prev = byPath.get(norm);
    if (
      prev === undefined ||
      rawPath < prev.raw ||
      (rawPath === prev.raw && source < prev.source)
    ) {
      byPath.set(norm, { raw: rawPath, source });
    }
  }

  const rows = [...byPath.entries()]
    .map(([path, c]) => ({ path, source: c.source }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const known = new Set(rows.map((r) => r.path));

  // Dependency in-degree within the tree: distinct importers per target.
  const importedBy = new Map<string, Set<string>>();
  for (const r of rows) {
    const masked = maskLiteralsAndComments(r.source);
    const targets = new Set<string>();
    for (const spec of importSpecifiers(masked, r.source)) {
      if (!LOCAL_SPEC.test(spec)) continue;
      const target = resolveLocal(spec, r.path, known);
      if (target === null || target === r.path) continue;
      targets.add(target);
    }
    for (const t of targets) {
      const set = importedBy.get(t);
      if (set) set.add(r.path);
      else importedBy.set(t, new Set([r.path]));
    }
  }

  const all: RepoMapEntry[] = rows.map((r) => {
    const symbols = runtimeExportNamesOf(r.source);
    const shown = symbolsPerFile <= 0 ? [] : symbols.slice(0, symbolsPerFile);
    const base = {
      path: r.path,
      symbols: shown,
      symbolCount: symbols.length,
      hidden: symbols.length - shown.length,
      inbound: importedBy.get(r.path)?.size ?? 0,
      lines: r.source.length === 0 ? 0 : r.source.split("\n").length,
      role: roleOf(r.path, r.source, entryPath),
    };
    return { ...base, score: scoreOf(base) };
  });
  all.sort((a, b) => b.score - a.score || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  // Budgeted render: fit the ranked prefix, reserving the elision marker's size.
  const lines = all.map(entryLine);
  const prefixFor = (n: number): string => lines.slice(0, n).join("\n");
  let fitted = 0;
  let used = 0;
  for (let i = 0; i < lines.length; i++) {
    const candidateLen = (i > 0 ? 1 : 0) + lines[i]!.length;
    const remaining = lines.length - (i + 1);
    const reserve = remaining > 0 ? 1 + repoMapElisionMarker(remaining, budget).length : 0;
    if (used + candidateLen + reserve > budget) break;
    used += candidateLen;
    fitted = i + 1;
  }
  let omitted = lines.length - fitted;
  // The loop reserved the marker for the count *had* the next line fit; recompute
  // the true omitted count and drop shown lines until the real marker fits.
  while (fitted > 0 && omitted > 0) {
    const markerLen = repoMapElisionMarker(omitted, budget).length;
    if (prefixFor(fitted).length + 1 + markerLen <= budget) break;
    fitted -= 1;
    omitted += 1;
  }
  const rendered =
    omitted > 0
      ? fitted > 0
        ? `${prefixFor(fitted)}\n${repoMapElisionMarker(omitted, budget)}`
        : repoMapElisionMarker(omitted, budget)
      : prefixFor(lines.length);

  return {
    entries: all.slice(0, fitted),
    totalFiles: all.length,
    shownFiles: fitted,
    omitted,
    truncated: omitted > 0,
    budget,
    chars: rendered.length,
    rendered,
    empty: all.length === 0,
  };
}

/** Structural view of the project fields the map reads — no cast, no widening. */
export interface RepoMapProjectLike {
  generatedTree?: readonly { path?: unknown; source?: unknown }[] | null;
  generatedSource?: unknown;
}

/**
 * repoMapForProject — build the map from a project's persisted generated bytes:
 * `generatedTree` when present, else the legacy single `generatedSource` at the
 * emitter's fixed host path, else an honest empty map. Never throws on junk.
 */
export function repoMapForProject(
  project: RepoMapProjectLike | null | undefined,
  opts?: { budget?: number; symbolsPerFile?: number; entry?: string },
): RepoMap {
  const src = project && typeof project === "object" ? project : null;
  const files: RepoMapFile[] = [];
  const tree = Array.isArray(src?.generatedTree) ? src!.generatedTree! : [];
  for (const f of tree) {
    if (!f || typeof f !== "object") continue;
    const path = (f as { path?: unknown }).path;
    const source = (f as { source?: unknown }).source;
    if (typeof path === "string" && typeof source === "string") files.push({ path, source });
  }
  if (files.length === 0) {
    const single = src?.generatedSource;
    if (typeof single === "string" && single.trim() !== "") {
      files.push({ path: REPO_MAP_ENTRY_PATH, source: single });
    }
  }
  return buildRepoMap(files, opts);
}
