// ---------------------------------------------------------------------------
// ast-mine.ts — structural codebase map (Pillar 5: codebase mining).
//
// mineCodebase(files) turns a list of {path, body} source texts into a
// structural map: per-file imports/exports/function inventory plus a
// dependency graph with edges only between files that actually appear in the
// input set (relative and "@/"-alias specifiers are resolved; bare package
// specifiers are tallied as `externals`, never as edges).
//
// HONEST LABEL: this is REGEX-BASED STRUCTURAL EXTRACTION, not a real AST
// parser. It deliberately understands the shapes this codebase writes —
// top-of-file import blocks (incl. multi-line braces), side-effect imports,
// single-line dynamic import(), named/default/star exports, free functions,
// `const x = (...) =>` arrows and single-line class/interface methods. No
// comment/string awareness, no formatting tolerance: exotic layouts are
// MISSED, not guessed at. Do not use its output as ground truth for
// refactors; use it for orientation and convention mining.
//
// All functions here are pure and deterministic (no clock, no RNG, no IO):
// identical input arrays produce deep-equal output, so tests can assert exact
// maps and maps can be diffed across commits.
// ---------------------------------------------------------------------------
import { posix } from "node:path";

export interface MineSourceFile {
  path: string;
  body: string;
}

export type FunctionKind = "function" | "method" | "arrow";

export interface FunctionSig {
  name: string;
  kind: FunctionKind;
  exported: boolean;
  /** 1-based line of the declaration, in source order. */
  line: number;
}

export interface MineFileEntry {
  path: string;
  lines: number;
  /** Unique specifiers in order of appearance (static, side-effect, dynamic). */
  imports: string[];
  /** Unique named exports (re-exported names included) in order of appearance. */
  exports: string[];
  /** Export name, or "(anonymous)", or null when the file has no default export. */
  defaultExport: string | null;
  /** Specifiers of `export * from "…"` lines. */
  reExports: string[];
  functions: FunctionSig[];
}

export interface DependencyEdge {
  from: string;
  to: string;
  specifier: string;
}

export interface CodebaseStats {
  files: number;
  imports: number;
  internalEdges: number;
  externals: number;
  unresolved: number;
}

export interface CodebaseMap {
  files: MineFileEntry[];
  dependencyGraph: {
    /** All file paths, sorted. */
    nodes: string[];
    /** Internal edges only — every `to` exists in `nodes`. */
    edges: DependencyEdge[];
    /** Distinct bare/package specifiers (sorted) that never resolve to a mined file. */
    externals: string[];
    /** Distinct local specifiers (./ ../ @/) that did not resolve to a mined file. */
    unresolved: string[];
  };
  stats: CodebaseStats;
}

// --- small helpers ---------------------------------------------------------

const norm = (p: string) => p.replace(/\\/g, "/").replace(/^\.\//, "");

const CONTROLS = new Set([
  "if", "for", "while", "switch", "catch", "do", "else", "return", "new",
  "delete", "typeof", "instanceof", "in", "of", "function", "class",
  "interface", "type", "import", "export", "case", "throw", "try", "await",
  "yield", "void", "with", "debugger",
]);

function pushUnique(list: string[], value: string): void {
  if (!list.includes(value)) list.push(value);
}

/** Extract the first quoted string of `line` (handles ' and "). */
function firstQuote(line: string): string | null {
  const m = /["']([^"']+)["']/.exec(line);
  return m ? m[1] : null;
}

const FROM_QUOTE = /\bfrom\s*["']([^"']+)["']/;

// --- per-file scanning -----------------------------------------------------

function scanFile(file: MineSourceFile): MineFileEntry {
  const body = file.body.replace(/\r\n/g, "\n");
  const lines = body.split("\n");
  const n = body.length === 0 ? 0 : lines.length;

  const imports: string[] = [];
  const exports_: string[] = [];
  const reExports: string[] = [];
  const functions: FunctionSig[] = [];
  let defaultExport: string | null = null;

  const addImport = (spec: string) => pushUnique(imports, spec);
  const addExport = (name: string) => pushUnique(exports_, name);
  const addFn = (name: string, kind: FunctionKind, exported: boolean, line: number) =>
    functions.push({ name, kind, exported, line });

  // Brace-depth tracker used ONLY to decide "are we lexically inside a
  // class/interface body" so method candidates are not harvested from free
  // code. Only CLASS bodies yield method inventory (interface signatures are
  // types, not runtime functions). Strings/comments are not parsed —
  // documented best effort.
  let braceDepth = 0;
  let typeBase: number | null = null; // braceDepth at the class/interface `{`
  let typeKind: "class" | "interface" | null = null;
  const delta = (line: string) => {
    let d = 0;
    for (const ch of line) {
      if (ch === "{") d += 1;
      else if (ch === "}") d -= 1;
    }
    return d;
  };

  const parseExportList = (text: string, withFrom: boolean) => {
    const names = text.slice(text.indexOf("{") + 1, text.lastIndexOf("}"));
    for (const raw of names.split(",")) {
      const item = raw.trim().replace(/^type\s+/, "");
      if (!item) continue;
      // `local as public` exports the ALIAS (`public`), not the local binding:
      // take the last `as` segment; a plain specifier is its own exported name.
      const asParts = item.split(/\s+as\s+/);
      const name = (asParts.length > 1 ? asParts[asParts.length - 1]! : asParts[0]!).trim();
      if (name) addExport(name);
    }
    if (withFrom) {
      const m = FROM_QUOTE.exec(text);
      if (m) addImport(m[1]);
    }
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();
    const lineNo = i + 1;

    // -- imports -----------------------------------------------------------
    if (/^import\s*\(/.test(t)) {
      // Single-line dynamic import(): `const x = await import("./y")`.
      const spec = firstQuote(line);
      if (spec) addImport(spec);
      i += 1;
      continue;
    }
    if (/^import\s+["']/.test(t)) {
      // Side-effect import: `import "./styles.css"`.
      const spec = firstQuote(line);
      if (spec) addImport(spec);
      i += 1;
      continue;
    }
    if (/^import\b/.test(t)) {
      if (FROM_QUOTE.test(line)) {
        const spec = FROM_QUOTE.exec(line)![1];
        addImport(spec);
        i += 1;
        continue;
      }
      if (line.includes("{") && !line.includes("}")) {
        // Multi-line named import block — swallow lines until the closing `}`.
        let block = line;
        while (i + 1 < lines.length && !lines[i + 1].includes("}")) {
          i += 1;
          block += "\n" + lines[i];
        }
        if (i + 1 < lines.length) {
          i += 1;
          block += "\n" + lines[i];
        }
        const m = FROM_QUOTE.exec(block);
        if (m) addImport(m[1]);
        i += 1;
        continue;
      }
      if (/\bfrom\s*["']$/.test(line)) {
        // `import x from` with the specifier on the next line (rare).
        let block = line;
        let guard = 0;
        while (guard < 3 && i + 1 < lines.length && !FROM_QUOTE.test(block)) {
          i += 1;
          block += "\n" + lines[i];
          guard += 1;
        }
        const m = FROM_QUOTE.exec(block);
        if (m) addImport(m[1]);
        i += 1;
        continue;
      }
      i += 1;
      continue;
    }

    // -- re-exports / export lists ----------------------------------------
    if (/^export\s*\*/.test(t)) {
      const m = FROM_QUOTE.exec(line);
      if (m) {
        addImport(m[1]);
        pushUnique(reExports, m[1]);
      }
      i += 1;
      continue;
    }
    if (/^export\s*\{/.test(t)) {
      let block = line;
      if (!line.includes("}")) {
        while (i + 1 < lines.length && !lines[i + 1].includes("}")) {
          i += 1;
          block += "\n" + lines[i];
        }
        if (i + 1 < lines.length) {
          i += 1;
          block += "\n" + lines[i];
        }
      }
      parseExportList(block, FROM_QUOTE.test(block));
      i += 1;
      continue;
    }

    // -- export declarations ----------------------------------------------
    const defM = /^export\s+default\s+(?:async\s+)?(?:function\s+([A-Za-z_$][\w$]*)|class\s+([A-Za-z_$][\w$]*)|const\s+([A-Za-z_$][\w$]*))/.exec(t);
    if (defM) {
      defaultExport = defM[1] ?? defM[2] ?? defM[3];
      if (defM[1]) addFn(defM[1], "function", true, lineNo);
      if (defM[3] && /=>/.test(line)) addFn(defM[3], "arrow", true, lineNo);
      i += 1;
      continue;
    }
    if (/^export\s+default\b/.test(t)) {
      defaultExport = "(anonymous)";
      i += 1;
      continue;
    }

    const expFn = /^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/.exec(t);
    if (expFn) {
      addExport(expFn[1]);
      addFn(expFn[1], "function", true, lineNo);
      i += 1;
      continue;
    }
    const expConst = /^export\s+(?:async\s+)?const\s+([A-Za-z_$][\w$]*)/.exec(t);
    if (expConst) {
      addExport(expConst[1]);
      if (/=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/.test(line)) {
        addFn(expConst[1], "arrow", true, lineNo);
      }
      i += 1;
      continue;
    }
    const expType = /^export\s+type\s+([A-Za-z_$][\w$]*)/.exec(t);
    if (expType) {
      addExport(expType[1]);
      i += 1;
      continue;
    }

    // -- class/interface scope tracking (classes also count as exports) ----
    const clsDecl = /^(export\s+|abstract\s+)*(class|interface)\s+([A-Za-z_$][\w$]*)/.exec(t);
    if (clsDecl) {
      if (clsDecl[1]?.includes("export")) addExport(clsDecl[3]);
      // Open a type scope at the CURRENT depth; we are "inside" once the
      // line's own `{` has been applied to the counter.
      const opened = typeBase === null;
      const base = braceDepth;
      braceDepth += delta(line);
      if (opened && braceDepth > base) {
        typeBase = base;
        typeKind = clsDecl[2] === "class" ? "class" : "interface";
      }
      i += 1;
      continue;
    }
    const freeFn = /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/.exec(t);
    if (freeFn) {
      addFn(freeFn[1], "function", t.startsWith("export "), lineNo);
      if (t.startsWith("export ")) addExport(freeFn[1]);
      braceDepth += delta(line);
      i += 1;
      continue;
    }
    const arrowConst = /^(?:export\s+)?(?:async\s+)?const\s+([A-Za-z_$][\w$]*)/.exec(t);
    if (arrowConst) {
      if (/=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/.test(line)) {
        addFn(arrowConst[1], "arrow", t.startsWith("export "), lineNo);
      }
      braceDepth += delta(line);
      i += 1;
      continue;
    }

    // Method candidates: only while lexically inside a CLASS body.
    if (typeKind === "class" && typeBase !== null && braceDepth > typeBase) {
      const m = /^(?:(?:public|private|protected|static|readonly|abstract|override|async|get|set)\s+)*([A-Za-z_$][\w$]*)\s*\(/.exec(t);
      const looksLikeMethod =
        m !== null &&
        !CONTROLS.has(m[1]) &&
        !line.includes("=") &&
        !line.includes("=>") &&
        (line.includes("{") || t.endsWith(";"));
      if (looksLikeMethod) addFn(m![1], "method", false, lineNo);
    }

    braceDepth += delta(line);
    if (typeBase !== null && braceDepth <= typeBase) {
      typeBase = null;
      typeKind = null;
    }
    i += 1;
  }

  return {
    path: file.path,
    lines: n,
    imports,
    exports: exports_,
    defaultExport,
    reExports,
    functions,
  };
}

// --- dependency resolution -------------------------------------------------

const LOCAL = /^(?:\.\.?\/|@\/)/;

function resolveLocal(spec: string, fromPath: string, known: Set<string>): string | null {
  let base: string;
  if (spec.startsWith("@/")) {
    // tsconfig `paths` maps "@/…" onto the project root's src/.
    base = posix.normalize(`src/${spec.slice(2)}`);
  } else {
    base = posix.normalize(posix.join(posix.dirname(fromPath), spec));
  }
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
  for (const c of candidates) {
    if (known.has(c)) return c;
  }
  return null;
}

// --- public API ------------------------------------------------------------

/**
 * mineCodebase — structural map of `files`. Deterministic: the returned map's
 * file list and graph nodes are sorted by path, and every other array keeps
 * source order. See the HONEST LABEL at the top of this file for scope.
 */
export function mineCodebase(files: MineSourceFile[]): CodebaseMap {
  // Fail closed on junk rows (hand-built/hostile inputs): rows without a
  // string path+body are skipped, never allowed to crash the miner.
  const rows = Array.isArray(files) ? files : [];
  const clean = rows.filter(
    (f): f is MineSourceFile =>
      f !== null &&
      typeof f === "object" &&
      typeof (f as { path?: unknown }).path === "string" &&
      typeof (f as { body?: unknown }).body === "string",
  );
  // One logical file per NORMALIZED path: the same file spelled once with
  // slashes and once with backslashes (or listed twice) must yield ONE map
  // entry — otherwise its imports would fan out into duplicate graph edges
  // and inflated stats. The surviving row is chosen independently of input
  // order (lexicographically smallest raw path wins; exact duplicates keep
  // the lexicographically smallest body) so reordered inputs stay deep-equal.
  const byNorm = new Map<string, MineSourceFile>();
  for (const f of clean) {
    const key = norm(f.path);
    const existing = byNorm.get(key);
    if (
      existing === undefined ||
      f.path < existing.path ||
      (f.path === existing.path && f.body < existing.body)
    ) {
      byNorm.set(key, f);
    }
  }
  const unique = [...byNorm.values()];
  const known = new Set(unique.map((f) => norm(f.path)));
  const entries = unique.map((f) => scanFile({ path: norm(f.path), body: f.body }));
  entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const edges: DependencyEdge[] = [];
  const externals = new Set<string>();
  const unresolved = new Set<string>();

  for (const entry of entries) {
    for (const spec of entry.imports) {
      if (!LOCAL.test(spec)) {
        externals.add(spec);
        continue;
      }
      const target = resolveLocal(spec, entry.path, known);
      if (target === null) {
        unresolved.add(spec);
        continue;
      }
      if (target !== entry.path) edges.push({ from: entry.path, to: target, specifier: spec });
    }
  }
  edges.sort((a, b) =>
    a.from === b.from ? (a.to < b.to ? -1 : a.to > b.to ? 1 : 0) : a.from < b.from ? -1 : 1,
  );

  return {
    files: entries,
    dependencyGraph: {
      nodes: entries.map((e) => e.path),
      edges,
      externals: [...externals].sort(),
      unresolved: [...unresolved].sort(),
    },
    stats: {
      files: entries.length,
      imports: entries.reduce((s, e) => s + e.imports.length, 0),
      internalEdges: edges.length,
      externals: externals.size,
      unresolved: unresolved.size,
    },
  };
}

// --- convention mining (Pillar 5 companion) --------------------------------

export interface ConventionsMap {
  project: string;
  /** File-path style counts over the mined files (kebab-case, camelCase, …). */
  fileStyles: Record<string, number>;
  /** Function-name style counts (camelCase, snake_case, PascalCase, other). */
  functionStyles: Record<string, number>;
  /** Named-export total vs files carrying a default export. */
  namedVsDefault: { named: number; defaultFiles: number };
  /** Distinct import specifiers ranked by frequency across files (top 8). */
  topImports: { specifier: string; count: number }[];
  /** Human notes derived from the tallies (deterministic, sorted). */
  notes: string[];
}

export function nameStyle(name: string): string {
  const stem = name.replace(/^[.#!]+/, "").split(".")[0] ?? name;
  if (stem.includes("-")) return "kebab-case";
  if (stem.includes("_")) return "snake_case";
  if (/^[A-Z]/.test(stem)) return "PascalCase";
  if (/^[a-z]/.test(stem)) return "camelCase";
  return "other";
}

function dominant(record: Record<string, number>): { style: string; count: number; total: number } | null {
  const pairs = Object.entries(record).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  let best: { style: string; count: number } | null = null;
  let total = 0;
  for (const [style, count] of pairs) {
    total += count;
    if (best === null || count > best.count) best = { style, count };
  }
  return best === null ? null : { ...best, total };
}

/**
 * conventionsMap — naming/utility notes for a project's mined files.
 * Pure and deterministic; the caller decides what "project" means.
 */
export function conventionsMap(project: string, files: MineSourceFile[]): ConventionsMap {
  const map = mineCodebase(files);

  const fileStyles: Record<string, number> = {};
  const functionStyles: Record<string, number> = {};
  let named = 0;
  let defaultFiles = 0;
  const importCounts = new Map<string, number>();

  for (const entry of map.files) {
    const stem = entry.path.split("/").pop() ?? entry.path;
    const fs_ = nameStyle(stem);
    fileStyles[fs_] = (fileStyles[fs_] ?? 0) + 1;
    named += entry.exports.length;
    if (entry.defaultExport !== null) defaultFiles += 1;
    for (const fn of entry.functions) {
      const st = nameStyle(fn.name);
      functionStyles[st] = (functionStyles[st] ?? 0) + 1;
    }
    for (const spec of entry.imports) importCounts.set(spec, (importCounts.get(spec) ?? 0) + 1);
  }

  const topImports = [...importCounts.entries()]
    .map(([specifier, count]) => ({ specifier, count }))
    .sort((a, b) => (b.count - a.count !== 0 ? b.count - a.count : a.specifier < b.specifier ? -1 : 1))
    .slice(0, 8);

  const notes: string[] = [];
  const fDom = dominant(fileStyles);
  if (fDom && fDom.total > 0) {
    const pct = Math.round((fDom.count / fDom.total) * 100);
    notes.push(`File paths: ${fDom.style} dominant (${fDom.count}/${fDom.total}, ${pct}%).`);
  }
  const fnDom = dominant(functionStyles);
  if (fnDom && fnDom.total > 0) {
    notes.push(`Function names: ${fnDom.style} dominant (${fnDom.count}/${fnDom.total}).`);
  }
  if (named === 0 && defaultFiles === 0) notes.push("No exports detected (all side-effect or empty modules?).");
  else if (defaultFiles === 0) notes.push(`Named exports everywhere (${named} named; no default exports).`);
  else notes.push(`${named} named exports across ${map.files.length} files; ${defaultFiles} file(s) with a default export.`);
  if (topImports.length > 0) {
    notes.push(`Top import: "${topImports[0].specifier}" in ${topImports[0].count} file(s).`);
  }
  notes.sort();

  return { project, fileStyles, functionStyles, namedVsDefault: { named, defaultFiles }, topImports, notes };
}

// --- convention respect (advisory injection) -------------------------------

export interface ConventionPacket {
  /** The name being proposed (function, component, or file stem). */
  name: string;
  kind: "function" | "component" | "file" | "symbol";
  /** Optional full path for `file` packets — only the stem is judged. */
  path?: string;
}

export interface ConventionVerdict {
  /** Advisory strings, one per observed conflict. Empty when conforming. */
  advisories: string[];
  /**
   * Markdown advisory block ready to append to a packet body — empty string
   * when the packet conforms. Injecting is advisory: it never blocks.
   */
  injected: string;
}

/**
 * respectConventions — compares a proposed name against the mined dominant
 * conventions and returns advisory notes (never enforcement). A packet whose
 * name follows the dominant style receives zero advisories.
 */
export function respectConventions(packet: ConventionPacket, map: ConventionsMap): ConventionVerdict {
  // W40 N1 (H1 leftover): a foreign packet shape (missing/non-string name)
  // offers nothing to judge — the honest verdict is empty, never a crash.
  if (!packet || typeof packet.name !== "string") return { advisories: [], injected: "" };
  const advisories: string[] = [];
  const name = packet.name.replace(/^[.#!]+/, "");

  if (packet.kind === "function" || packet.kind === "component") {
    const dom = dominant(map.functionStyles);
    const style = nameStyle(name);
    if (dom && dom.count >= 2 && style !== dom.style) {
      advisories.push(
        `advisory: ${packet.kind} "${name}" uses ${style}; mined convention for ${map.project} is ${dom.style} (${dom.count}/${dom.total} function names). Rename or document the deviation.`,
      );
    }
  }

  if (packet.kind === "file" && packet.path) {
    const dom = dominant(map.fileStyles);
    const stem = (packet.path.replace(/\\/g, "/").split("/").pop() ?? packet.path).split(".")[0];
    const style = nameStyle(stem);
    if (dom && dom.count >= 2 && style !== dom.style) {
      advisories.push(
        `advisory: file "${packet.path}" uses ${style} stem; mined convention for ${map.project} is ${dom.style} paths (${dom.count}/${dom.total}).`,
      );
    }
  }

  const injected =
    advisories.length === 0
      ? ""
      : `\n<!-- conventions advisory (ast-mine, advisory only) -->\n${advisories.map((a) => `- ${a}`).join("\n")}\n`;

  return { advisories, injected };
}
