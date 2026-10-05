#!/usr/bin/env node
/**
 * P-B · C-01 / C-02 / C-03 / C-13 — emitted-tree structural invariants.
 *
 * A static, keyless scan over a directory of emitted trees. It never runs the
 * generator, never loads the model, and never edits the tree: it reads the
 * REAL emitted bytes and fails closed when one of the historical P6 defects is
 * present. Every detector below carries the exact historical fixture it fires
 * on (INC ids from `_research/PREVENTION.md` §1) and a clean control it passes.
 *
 *   C-01  RT_E_PLAN_UNDERPRODUCED  under-production: a spec-graph job node the
 *         brief declares was never materialised as a tree file (INC-08/11/13).
 *   C-02  RT_E_DUPLICATE_EXPORT    a barrel `export *` re-exports the same
 *         identifier from ≥2 modules (TS2308, INC-15).
 *   C-03  RT_E_USE_BEFORE_DECL     a block-scoped binding is read in another
 *         top-level initializer before its own declaration (TS2448, INC-16).
 *   C-13  RT_E_MONEY_SEMANTICS     an export whose name/doc says pence/total/
 *         price accumulates a quantity field and never reads a price
 *         (FINDINGS F-01 / INC-26).
 *
 * Usage:
 *   node scripts/guards/tree-invariants.mjs --trees <dir> [<dir> ...] [--json]
 *   node scripts/guards/tree-invariants.mjs --root <testruns> [--json]
 *   node scripts/guards/tree-invariants.mjs --registry scripts/guards/guard-registry.json [--json]
 *   node scripts/guards/tree-invariants.mjs --selftest [--json]
 *
 * Exit codes:
 *   0  every scanned tree is clean (lint) / every registered fired-on-historical
 *      + clean-control proof holds (registry/selftest)
 *   1  at least one finding (lint) / a registered guard missed its historical
 *      fixture or fired on its clean control (registry/selftest)
 *   2  usage / unreadable input (fail closed)
 *
 * No allowlist here: a finding is a finding. Exemptions for README rows live in
 * `readme-parity.mjs`, each with a written reason, and a now-passing exemption
 * fails that guard.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { isMainModule, projectRoot } from "../with-app-env.mjs";

const SKIP_DIRS = new Set(["node_modules", ".git", ".rapidtool", "dist", "build", "coverage", ".output", ".vercel", ".next"]);
const SOURCE_RE = /\.(?:ts|tsx|js|jsx|mjs)$/;
// Top-level only (column 0): a nested block-scoped declaration is in a
// different scope and can never be a TDZ reference for a module-scope binding.
const DECL_RE = /^(?:export\s+)?(const|let|var|class)\s+([A-Za-z_$][A-Za-z0-9_$]*)/;
const EXPORT_DECL_RE = /(^|\n)[ \t]*export\s+(?:async\s+)?(?:function|const|let|var|class|type|interface|enum)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
const EXPORT_LIST_RE = /(^|\n)[ \t]*export\s*\{([^}]*)\}/g;
const BARREL_RE = /(^|\n)[ \t]*export\s*\*\s*from\s*["']([^"']+)["']/g;

/** POSIX, root-relative path for a human-readable finding. */
function rel(root, file) {
  return relative(root, file).replace(/\\/g, "/");
}

/** Read a file, returning "" on any failure (the caller reports nothing, never guesses). */
function safeRead(file) {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

/**
 * Replace string literals and comments with spaces, preserving newlines so line
 * numbers stay aligned. Deterministic, no regex literals template `${}` nesting
 * handling — it only has to keep `export`/identifier tokens from appearing
 * inside a string or comment.
 */
export function maskLiteralsAndComments(source) {
  const src = typeof source === "string" ? source : "";
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "/") {
      while (i < n && src[i] !== "\n") {
        out += " ";
        i += 1;
      }
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      out += "  ";
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) {
        out += src[i] === "\n" ? "\n" : " ";
        i += 1;
      }
      if (i < n) {
        out += "  ";
        i += 2;
      }
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      out += " ";
      i += 1;
      while (i < n && src[i] !== quote) {
        if (src[i] === "\\") {
          out += "  ";
          i += 2;
          continue;
        }
        out += src[i] === "\n" ? "\n" : " ";
        i += 1;
      }
      if (i < n) {
        out += " ";
        i += 1;
      }
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

/** Mask comments only, leaving string literals intact (module specifiers stay visible). */
export function maskCommentsOnly(source) {
  const src = typeof source === "string" ? source : "";
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    if (src[i] === "/" && src[i + 1] === "/") {
      while (i < n && src[i] !== "\n") {
        out += " ";
        i += 1;
      }
      continue;
    }
    if (src[i] === "/" && src[i + 1] === "*") {
      out += "  ";
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) {
        out += src[i] === "\n" ? "\n" : " ";
        i += 1;
      }
      if (i < n) {
        out += "  ";
        i += 2;
      }
      continue;
    }
    out += src[i];
    i += 1;
  }
  return out;
}

/** Every source file under `root`, excluding build/vendor/dot directories. */
export function walkSourceFiles(root) {
  const out = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.isSymbolicLink()) continue;
        walk(full);
      } else if (SOURCE_RE.test(entry.name) && !/\.d\.(?:ts|mts)$/.test(entry.name)) {
        out.push(full);
      }
    }
  };
  walk(root);
  return out.sort();
}

/** Top-level exported names of a masked module, with their 1-based line numbers. */
export function collectExports(masked) {
  /** @type {{ name: string, line: number }[]} */
  const out = [];
  const lineOf = (index) => masked.slice(0, index).split("\n").length;
  EXPORT_DECL_RE.lastIndex = 0;
  let m;
  while ((m = EXPORT_DECL_RE.exec(masked)) !== null) {
    out.push({ name: m[2], line: lineOf(m.index) });
  }
  EXPORT_LIST_RE.lastIndex = 0;
  while ((m = EXPORT_LIST_RE.exec(masked)) !== null) {
    const body = m[2];
    for (const part of body.split(",")) {
      const bits = part.trim().split(/\s+as\s+/);
      const name = (bits.length === 2 ? bits[1] : bits[0]).trim();
      if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) {
        out.push({ name, line: lineOf(m.index) });
      }
    }
  }
  return out;
}

/** Relative specifiers of `export * from "..."` lines in a masked module. */
export function collectBarrelTargets(masked) {
  const out = [];
  BARREL_RE.lastIndex = 0;
  let m;
  while ((m = BARREL_RE.exec(masked)) !== null) out.push(m[2]);
  return out;
}

/** Resolve a relative specifier to an existing source file inside the tree. */
export function resolveTreeSpecifier(spec, fromFile, _treeRoot) {
  if (!spec.startsWith(".")) return null;
  const base = resolve(dirname(fromFile), spec);
  const candidates = [base];
  if (!extname(base)) {
    candidates.push(`${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`, `${base}.mjs`, join(base, "index.ts"));
  } else if (base.endsWith(".js")) {
    candidates.push(`${base.slice(0, -3)}.ts`, `${base.slice(0, -3)}.tsx`);
  }
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

/**
 * C-02 — a barrel `export *` that pulls the same exported identifier from two
 * distinct modules. TS2308 at load; the tree is unbootable (INC-15).
 * @param {string} treeDir
 */
export function detectDuplicateExports(treeDir) {
  const files = walkSourceFiles(treeDir);
  const fileSet = new Set(files);
  /** @type {Map<string, { name: string, line: number }[]>} */
  const exportsByFile = new Map();
  /** @type {Map<string, string>} */
  const maskedByFile = new Map();
  /** @type {Map<string, string>} */
  const barrelSourceByFile = new Map();
  for (const file of files) {
    const source = safeRead(file);
    maskedByFile.set(file, maskLiteralsAndComments(source));
    barrelSourceByFile.set(file, maskCommentsOnly(source));
    exportsByFile.set(file, collectExports(maskedByFile.get(file) ?? ""));
  }
  const findings = [];
  for (const file of files) {
    // Module specifiers live inside string literals, so read the barrel lines
    // from a comment-masked copy (strings intact), never the fully masked one.
    const masked = barrelSourceByFile.get(file) ?? "";
    const targets = collectBarrelTargets(masked);
    if (targets.length === 0) continue;
    /** @type {Map<string, string[]>} */
    const providers = new Map();
    for (const spec of targets) {
      const target = resolveTreeSpecifier(spec, file, treeDir);
      if (!target || !fileSet.has(target)) continue;
      for (const exp of exportsByFile.get(target) ?? []) {
        const list = providers.get(exp.name) ?? [];
        if (!list.includes(target)) list.push(target);
        providers.set(exp.name, list);
      }
    }
    for (const [name, list] of providers) {
      if (list.length >= 2) {
        findings.push({
          code: "RT_E_DUPLICATE_EXPORT",
          file: rel(treeDir, file),
          name,
          providers: list.map((p) => rel(treeDir, p)),
          detail: `barrel re-exports '${name}' from ${list.length} modules`,
        });
      }
    }
  }
  return findings;
}

/** End line (exclusive) of the statement starting at `startLine` (0-based). */
function statementEnd(lines, startLine) {
  let depth = 0;
  for (let i = startLine; i < lines.length && i < startLine + 80; i += 1) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === "(" || ch === "[" || ch === "{") depth += 1;
      else if (ch === ")" || ch === "]" || ch === "}") depth -= 1;
    }
    if (depth <= 0 && /;\s*$/.test(line)) return i + 1;
    if (depth <= 0 && i > startLine) return i + 1;
  }
  return Math.min(lines.length, startLine + 1);
}

/** Is `id` read as a property (`.id`) rather than a free value? */
function isPropertyRead(text, id) {
  const re = new RegExp(`\\??\\s*\\.\\s*${id}\\b`, "g");
  re.lastIndex = 0;
  let count = 0;
  while (re.exec(text) !== null) count += 1;
  const total = (text.match(new RegExp(`\\b${id}\\b`, "g")) ?? []).length;
  return count > 0 && count >= total;
}

/**
 * C-03 — a block-scoped binding read in another top-level declaration's
 * initializer before its own declaration (TS2448, INC-16). Only top-level
 * initializers are scanned, matching TypeScript: a reference inside a function
 * body is deferred and not a TDZ error.
 * @param {string} treeDir
 */
export function detectUseBeforeDeclaration(treeDir) {
  const findings = [];
  const seen = new Set();
  for (const file of walkSourceFiles(treeDir)) {
    const masked = maskLiteralsAndComments(safeRead(file));
    const lines = masked.split("\n");
    /** @type {{ name: string, line: number, kind: string }[]} */
    const decls = [];
    for (let i = 0; i < lines.length; i += 1) {
      const m = DECL_RE.exec(lines[i]);
      if (m) decls.push({ name: m[2], line: i + 1, kind: m[1] });
    }
    /** @type {Map<string, number>} */
    const laterBlockScoped = new Map();
    for (const d of decls) {
      if (d.kind === "var") continue;
      if (!laterBlockScoped.has(d.name)) laterBlockScoped.set(d.name, d.line);
    }
    for (const d of decls) {
      const start = d.line - 1;
      const end = statementEnd(lines, start);
      const text = lines.slice(start, end).join("\n");
      const ids = text.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) ?? [];
      for (const id of ids) {
        const declLine = laterBlockScoped.get(id);
        if (declLine === undefined || id === d.name) continue;
        if (declLine <= d.line) continue;
        if (isPropertyRead(text, id)) continue;
        const key = `${file}:${id}:${d.line}`;
        if (seen.has(key)) continue;
        seen.add(key);
        findings.push({
          code: "RT_E_USE_BEFORE_DECL",
          file: rel(treeDir, file),
          name: id,
          usedAt: d.line,
          declaredAt: declLine,
          detail: `'${id}' is read in the initializer at line ${d.line} before its declaration at line ${declLine}`,
        });
        break;
      }
    }
  }
  return findings;
}

/**
 * C-01 — a spec-graph job node the brief declares was never materialised as a
 * generatedTree row (INC-08/11/13). Reads the tree's own persisted
 * `.rapidtool/project.json`; a tree without one is skipped, never guessed.
 * @param {string} treeDir
 */
export function detectUnderproduction(treeDir) {
  const projectPath = join(treeDir, ".rapidtool", "project.json");
  if (!existsSync(projectPath)) return [];
  let project;
  try {
    // A UTF-8 BOM is not a JSON token; the artifacts are rewritten by live runs.
    project = JSON.parse(readFileSync(projectPath, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return [];
  }
  const nodes = Array.isArray(project.specGraph?.nodes) ? project.specGraph.nodes : [];
  const declared = nodes
    .filter(
      (n) =>
        typeof n === "object" &&
        n !== null &&
        /^job-/.test(String(n.id ?? "")) &&
        typeof n.file === "string" &&
        n.file.length > 0,
    )
    .map((n) => String(n.file));
  if (declared.length < 5) return [];
  const emitted = (Array.isArray(project.generatedTree) ? project.generatedTree : [])
    .map((f) => (f && typeof f.path === "string" ? f.path : ""))
    .filter((p) => p.length > 0);
  const stem = (p) => basename(p).replace(/\.[^.]+$/, "");
  const covered = declared.filter((d) => emitted.includes(d) || emitted.some((e) => stem(e) === stem(d)));
  const missing = declared.filter((d) => !covered.includes(d));
  if (missing.length === 0) return [];
  return [
    {
      code: "RT_E_PLAN_UNDERPRODUCED",
      file: rel(treeDir, projectPath),
      declared: declared.length,
      materialised: covered.length,
      missing,
      detail: `brief declares ${declared.length} job node(s) but only ${covered.length} were materialised as tree files; missing: ${missing.join(", ")}`,
    },
  ];
}

/**
 * C-13 — an export whose name/documentation promises money (pence/total/price/
 * amount) but whose body accumulates only a quantity field and never reads a
 * price (FINDINGS F-01 / INC-26).
 * @param {string} treeDir
 */
export function detectMoneySemantics(treeDir) {
  const findings = [];
  const moneyName = /(?:pence|total|price|amount)/i;
  for (const file of walkSourceFiles(treeDir)) {
    const masked = maskLiteralsAndComments(safeRead(file));
    const original = safeRead(file);
    const exported = collectExports(masked).map((e) => e.name);
    for (const name of exported) {
      if (!moneyName.test(name)) continue;
      const fnRe = new RegExp(`(?:^|\\n)\\s*(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\(`);
      const hit = fnRe.exec(masked);
      if (!hit) continue;
      const braceAt = masked.indexOf("{", hit.index + hit[0].length);
      if (braceAt < 0) continue;
      let depth = 0;
      let end = braceAt;
      for (let i = braceAt; i < masked.length; i += 1) {
        if (masked[i] === "{") depth += 1;
        else if (masked[i] === "}") {
          depth -= 1;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      const body = masked.slice(braceAt, end);
      const doc = original.slice(Math.max(0, original.indexOf(name) - 220), original.indexOf(name));
      const promisesMoney = /pence|total|price|amount/i.test(doc) || moneyName.test(name);
      const accumulates = /(?:\+=|= *[A-Za-z_$][\w$]* *\+)/.test(body);
      const readsPrice = /\b(?:unitPrice|unitPricePence|price|pricePence|amount|amountPence|pence|cost|rate)\b/i.test(body);
      const readsQty = /\b(?:qty|quantity|count)\b/i.test(body);
      if (promisesMoney && accumulates && readsQty && !readsPrice) {
        findings.push({
          code: "RT_E_MONEY_SEMANTICS",
          file: rel(treeDir, file),
          export: name,
          detail: `'${name}' promises money but its body accumulates a quantity field and never reads a price`,
        });
      }
    }
  }
  return findings;
}

/** All findings for one tree, tagged with the detector that produced them. */
export function scanTree(treeDir) {
  const findings = [
    ...detectUnderproduction(treeDir),
    ...detectDuplicateExports(treeDir),
    ...detectUseBeforeDeclaration(treeDir),
    ...detectMoneySemantics(treeDir),
  ];
  return { dir: treeDir, findings };
}

/** Every `<root>/<slug>/emitted` and `<root>/<slug>/emitted.v2` directory. */
export function discoverTrees(root) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    for (const leaf of ["emitted", "emitted.v2"]) {
      const dir = join(root, entry.name, leaf);
      if (existsSync(dir) && statSync(dir).isDirectory()) out.push(dir);
    }
  }
  return out.sort();
}

/** Default testruns root: the sibling `testruns/` next to the repo, else in-repo. */
export function defaultTestrunsRoot() {
  const root = projectRoot();
  for (const candidate of [resolve(root, "..", "testruns"), join(root, "testruns")]) {
    if (existsSync(candidate)) return candidate;
  }
  return resolve(root, "..", "testruns");
}

/** Resolve a registry fixture spec against the repo and the testruns root. */
export function resolveFixture(spec, repoRoot, testrunsRoot) {
  if (isAbsolute(spec)) return existsSync(spec) ? spec : null;
  for (const candidate of [join(repoRoot, spec), join(testrunsRoot, spec)]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** @param {string} registryPath */
export function loadRegistry(registryPath) {
  const parsed = JSON.parse(readFileSync(registryPath, "utf8"));
  return Array.isArray(parsed.guards) ? parsed.guards : [];
}

/**
 * Run the registry entries that belong to this guard and assert each fires on
 * its historical fixture and is clean on its control. This is the
 * fired-on-historical proof; a guard that no longer fires is a miss and exits 1.
 */
function runRegistry(registryPath, json) {
  const repoRoot = projectRoot();
  const testrunsRoot = defaultTestrunsRoot();
  const entries = loadRegistry(registryPath).filter(
    (e) => e && typeof e.file === "string" && e.file.endsWith("tree-invariants.mjs"),
  );
  const results = [];
  let failed = false;
  for (const entry of entries) {
    const fixture = resolveFixture(String(entry.historicalFixture ?? ""), repoRoot, testrunsRoot);
    const control = entry.cleanControl ? resolveFixture(String(entry.cleanControl), repoRoot, testrunsRoot) : null;
    const detector = detectorFor(String(entry.detector ?? ""));
    if (!fixture || !detector) {
      results.push({ id: entry.id, ok: false, reason: "fixture-or-detector-unresolved" });
      failed = true;
      continue;
    }
    const fired = detector(fixture).length > 0;
    const controlClean = control ? detector(control).length === 0 : true;
    const ok = fired && controlClean;
    if (!ok) failed = true;
    results.push({ id: entry.id, fixture: rel(repoRoot, fixture), fired, control: control ? rel(repoRoot, control) : null, controlClean, ok });
  }
  if (json) {
    console.log(JSON.stringify({ guard: "tree-invariants", entries: results, ok: !failed }, null, 2));
  } else {
    for (const r of results) {
      console.log(`[tree-invariants] ${r.id}: fired=${r.fired} controlClean=${r.controlClean}${r.ok ? "" : "  ✗"}`);
    }
  }
  return failed ? 1 : 0;
}

function detectorFor(name) {
  if (name === "duplicate-export") return detectDuplicateExports;
  if (name === "use-before-declaration") return detectUseBeforeDeclaration;
  if (name === "underproduction") return detectUnderproduction;
  if (name === "money-semantics") return detectMoneySemantics;
  return null;
}

/** The built-in fired-on-historical proof (used by `--selftest`). */
export function selftest() {
  const repoRoot = projectRoot();
  const testrunsRoot = defaultTestrunsRoot();
  const checks = [
    { id: "C-01", detector: detectUnderproduction, fixture: "office-scheduler/emitted", control: "bakery-florist-orders/emitted" },
    { id: "C-02", detector: detectDuplicateExports, fixture: "bakery-florist-orders/emitted", control: "office-scheduler/emitted" },
    { id: "C-03", detector: detectUseBeforeDeclaration, fixture: "mobile-companion/emitted", control: "bakery-florist-orders/emitted" },
    { id: "C-13", detector: detectMoneySemantics, fixture: "mobile-companion/emitted", control: "office-invoice-tracker/emitted" },
  ];
  const entries = [];
  let ok = true;
  for (const check of checks) {
    const fixture = resolveFixture(check.fixture, repoRoot, testrunsRoot);
    const control = resolveFixture(check.control, repoRoot, testrunsRoot);
    const fired = fixture ? check.detector(fixture).length > 0 : false;
    const controlClean = control ? check.detector(control).length === 0 : false;
    if (!fired || !controlClean) ok = false;
    entries.push({ id: check.id, fixture: check.fixture, fired, control: check.control, controlClean });
  }
  return { ok, entries };
}

function usage(message) {
  if (message) console.error(`[tree-invariants] ${message}`);
  console.error("usage: node scripts/guards/tree-invariants.mjs --trees <dir...> | --root <testruns> | --registry <json> | --selftest [--json]");
  process.exit(2);
}

function main(argv) {
  const json = argv.includes("--json");
  const args = argv.filter((a) => a !== "--json");
  const repoRoot = projectRoot();

  if (args.includes("--selftest")) {
    const result = selftest();
    if (json) console.log(JSON.stringify({ guard: "tree-invariants", selftest: result }, null, 2));
    else for (const e of result.entries) console.log(`[tree-invariants] selftest ${e.id}: fired=${e.fired} controlClean=${e.controlClean}`);
    return result.ok ? 0 : 1;
  }

  const registryAt = args.indexOf("--registry");
  if (registryAt >= 0) {
    const path = args[registryAt + 1];
    if (!path) usage("--registry needs a path");
    return runRegistry(path, json);
  }

  /** @type {string[]} */
  let trees = [];
  const treesAt = args.indexOf("--trees");
  if (treesAt >= 0) {
    for (const value of args.slice(treesAt + 1)) {
      if (value.startsWith("--")) break;
      trees.push(resolve(repoRoot, value));
    }
  }
  const rootAt = args.indexOf("--root");
  if (rootAt >= 0) {
    const root = args[rootAt + 1];
    if (!root) usage("--root needs a directory");
    trees = discoverTrees(resolve(repoRoot, root));
  }
  if (trees.length === 0 && treesAt < 0 && rootAt < 0) {
    trees = discoverTrees(defaultTestrunsRoot());
  }
  const unreadable = trees.filter((t) => !existsSync(t));
  if (unreadable.length > 0) usage(`unreadable tree(s): ${unreadable.join(", ")}`);

  const onlyAt = args.indexOf("--only");
  const only = onlyAt >= 0 ? args[onlyAt + 1] : null;
  const reports = trees.map((t) => {
    if (!only) return scanTree(t);
    const detector = detectorFor(only);
    return { dir: t, findings: detector ? detector(t) : [] };
  });
  const total = reports.reduce((n, r) => n + r.findings.length, 0);
  if (json) {
    console.log(
      JSON.stringify(
        { guard: "tree-invariants", trees: reports.map((r) => ({ dir: r.dir, findings: r.findings })), findings: total, ok: total === 0 },
        null,
        2,
      ),
    );
  } else {
    for (const report of reports) {
      for (const f of report.findings) console.log(`${f.code} ${rel(repoRoot, report.dir)}/${f.file}: ${f.detail}`);
    }
    console.log(`[tree-invariants] ${reports.length} tree(s) scanned · ${total} finding(s)`);
  }
  return total === 0 ? 0 : 1;
}

if (isMainModule(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
