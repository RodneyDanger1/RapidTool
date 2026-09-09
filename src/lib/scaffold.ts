// ---------------------------------------------------------------------------
// scaffold.ts — E-15 scaffold emitter + E-27 shipped-artifact deploy notes.
//
// Turns one RapidTool Project into a deterministic, zero-dependency file tree
// (packet → code on disk): README.md, DEPLOY.md, .env.example, a per-kind
// package.json skeleton + tsconfig, .rapidtool/project.json (the live export),
// browser boot files for webapp/game kinds (index.html + vite.config.ts + a
// src/main entry — fixes/135, so `npm run build` really runs in the emitted
// dir), src/ modules derived from the spec graph (generatedSource embedded
// verbatim where it exists), and tests/oracle.spec.ts — REAL assertions over
// the emitted modules from the A7 oracle (fixes/135; no todo stubs), plus —
// for game projects — a placeholder game-asset manifest. Nothing touches the
// filesystem: callers (CLI emit, UI) write the returned {path, body} pairs.
//
// Pure + deterministic: same Project in ⇒ byte-identical files out. No
// Date.now(), no fs, no randomness; every timestamp is derived from project
// fields. All dynamic inserts are escaped (JSON stringify for code, single-
// line collapse for comments, safe-path segments, slugged package names) so
// hostile briefs/jobs/entity names cannot break out of strings, fences or
// paths. .env.example carries PLACEHOLDER values ONLY — never derived from
// project text, so it can never leak a real secret.
//
// fixes/144 (M2): when the project carries a non-empty Project.generatedTree,
// assembly switches to TREE mode — every valid tree file is emitted VERBATIM
// at its own repo-relative path (src/api|domain|jobs|state|ui|generated +
// tests/; sorted by path), spec-graph node files the tree does not cover
// become thin re-exports of the tree ENTRY module (the file at the path the
// legacy P6 host would have used — same selection rule), src/ui keeps its
// honest contract-level shell, and tests/oracle.spec.ts imports the tree
// entry so the emitted npm test exercises the REAL cross-file tree. Unsafe /
// reserved / duplicate tree rows are refused loudly (result.warnings). An
// empty or absent tree ⇒ the legacy single-module embed, byte-identical to
// pre-M2 output.
//
// Honest local-only framing (E-27): DEPLOY.md is a template derived from the
// P9/P12 artifacts recorded in the project; it states that the pipeline never
// executed or validated those templates and that nothing in the scaffold
// deploys anywhere by itself. Assets/ and public/ are expected at the emitted
// scaffold and are NOT engine-generated (explicit boundary in DEPLOY.md).
//
// EXACT EXPORT SURFACE (the CLI/UI agents compile against these — do not
// rename, and keep semantics below stable):
//
//   export type ProjectKind            "webapp"|"cli-tool"|"library"|"game"|"service"
//   export function projectKindOf(project: Project): ProjectKind
//   export function scaffoldProject(project: Project): ScaffoldResult
//   export function deplyNotes(project: Project): string   (DEPLOY.md content)
//
// Project.kind (types.ts) is a coarse optional 3-way union — "app"|"tool"|"game";
// projectKindOf maps it onto this 5-way taxonomy (declared kind wins) and
// otherwise infers from brief/domain/jobs keywords per the E-15 register spec,
// defaulting to "webapp".
// ---------------------------------------------------------------------------
import { PHASES } from "./phases.ts";
import { exportProjectJson, slugName } from "./io.ts";
import { canonicalStem } from "./algorithms.ts";
import { BRIEF_STOPWORDS } from "./sandbox.ts";
import {
  approvedAcceptanceFixtures,
  compileFixtureAssertion,
  fixtureMatchHelperSource,
} from "./brief-fixtures.ts";
import type { Project } from "./types.ts";

export type ProjectKind = "webapp" | "cli-tool" | "library" | "game" | "service";

export type ScaffoldFile = { path: string; body: string };

export type ScaffoldResult =
  | {
      ok: true;
      files: ScaffoldFile[];
      summary: string;
      /**
       * fixes/144 (M2): loud tree-assembly verdicts. One entry per generatedTree
       * row refused at assembly (unsafe/reserved/duplicate path, malformed row)
       * with its reason. Absent when nothing was refused; legacy (no-tree)
       * emissions never carry it. Callers (CLI emit summary) surface it.
       */
      warnings?: string[];
    }
  | { ok: false; error: string };

/** Register order matters: the first kind whose keyword matches wins. */
const KIND_ORDER: ProjectKind[] = ["webapp", "cli-tool", "library", "game", "service"];

const KIND_LABEL: Record<ProjectKind, string> = {
  webapp: "web app",
  "cli-tool": "CLI tool",
  library: "library",
  game: "game",
  service: "service",
};

/** E-15 #1 keyword scoring table (ui/dashboard/board/desk/portal → webapp; …). */
const KIND_KEYWORDS: Record<ProjectKind, string[]> = {
  webapp: ["ui", "dashboard", "board", "desk", "portal"],
  "cli-tool": ["parse", "convert", "cli", "agent", "script"],
  library: ["sdk", "package", "library"],
  game: ["game", "play", "level", "arcade"],
  service: ["api", "service", "webhook", "worker"],
};

/** The E-27 honesty stamp every DEPLOY.md must carry (verbatim). */
export const DEPLOY_HONESTY_STAMP =
  "> template derived from P9/P12 artifacts — verify credentials before any deploy";

const MACHINE_STAMP = (id: string): string =>
  `machine-generated from RapidTool packet ${id || "unknown"}; regenerate, don't hand-edit.`;

// ---------------------------------------------------------------------------
// Small deterministic text helpers (escaping lives here, once)
// ---------------------------------------------------------------------------

/** Collapse whitespace/control chars to single spaces and trim (line-safe). */
// C0 controls + DEL, injected via String.fromCharCode so the no-control-regex
// rule (escape-based static analysis) stays satisfied.
const CONTROL = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}]`,
  "g",
);
function collapse(raw: string): string {
  return String(raw ?? "")
    .replace(CONTROL, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** One-line prose for a comment: collapsed; comment-terminator sequences removed. */
function prose(raw: string): string {
  return collapse(raw).replace(/\*\//g, "* /");
}

/** JSON-escaped string literal body (safe inside '…', "…", `…` and fences). */
function jstr(raw: string): string {
  return JSON.stringify(String(raw ?? ""));
}

/**
 * A single safe path segment. Allowed: [A-Za-z0-9._-]; anything else becomes
 * "_"; "." / ".." / empty fall back to a caller-provided name. Never empty.
 */
function segment(raw: string, fallback: string): string {
  const seg = String(raw ?? "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^\.+/, "");
  return seg && seg !== "." && seg !== ".." ? seg : fallback;
}

/**
 * Sanitize a spec-graph node file path: split on "/", clean every segment,
 * forbid traversal ("..") and empty segments. Unsafe input degrades to a
 * stable derived path instead of failing (engine paths are already safe;
 * this defends hand-built / hostile projects).
 */
function safeNodePath(raw: string, nodeId: string, index: number): string {
  const fallback = `src/generated/${segment(nodeId, `node-${index}`)}.ts`;
  const parts = String(raw ?? "")
    .split("/")
    .map((p) => p.trim());
  if (!parts.length || parts.some((p) => !p || p === "." || p === "..")) return fallback;
  const cleaned = parts.map((p, i) => segment(p, i === parts.length - 1 ? "index" : "generated"));
  const path = cleaned.join("/");
  return /^[A-Za-z0-9_./-]+$/.test(path) && !path.includes("..") ? path : fallback;
}

// ---------------------------------------------------------------------------
// fixes/144 (M2): generatedTree → scaffold assembly helpers.
//
// A keyed P6 journey may land Project.generatedTree: {path, source, hash,
// attempt} rows (types.ts). When non-empty, scaffoldProject assembles those
// files instead of embedding one verbatim generatedSource module. Every path
// is validated BEFORE anything is emitted: only the scaffold's own src/
// subdirs (the spec-graph families api/domain/jobs/state/ui plus the
// src/generated fallback family) and tests/ are legal; traversal (".."),
// absolute paths (POSIX "/x" or Windows "C:\x" — any backslash), reserved
// scaffold files and junk shapes are REFUSED loudly (result.warnings) and
// the row is skipped. Assembly stays pure + deterministic: tree files are
// emitted verbatim (never wrapped in scaffold headers), sorted by path.
// ---------------------------------------------------------------------------

/** Repo-relative roots a generatedTree file may be assembled at. */
const TREE_ALLOWED_ROOTS = [
  "src/api/",
  "src/domain/",
  "src/jobs/",
  "src/state/",
  "src/ui/",
  "src/generated/",
  "tests/",
];

/** Scaffold-owned files a tree may never overwrite (tests/oracle.spec.ts is
 * the machine-verified acceptance contract — fixes/135 — always emitted by
 * the scaffold itself; boot entries live outside the allowed roots). */
const TREE_RESERVED = new Set(["tests/oracle.spec.ts"]);

/** A single safe path segment — the same charset the emitter's own paths use. */
const TREE_SEGMENT = /^[A-Za-z0-9._-]+$/;

/**
 * Validate one generatedTree row's path for assembly. Returns null when safe
 * (the path is emitted verbatim), else a human reason for the refusal.
 * Defensive by construction: a hostile tree row can never traverse out of the
 * emitted scaffold or shadow an infra file.
 */
function treePathRefusal(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return "path is not a non-empty string";
  const p = raw;
  if (p.includes("\\"))
    return `backslash path ${JSON.stringify(p)} is not repo-relative (Windows separators refused)`;
  if (p.startsWith("/")) return `absolute path ${JSON.stringify(p)} is not repo-relative`;
  if (/^[A-Za-z]:/.test(p))
    return `drive-absolute path ${JSON.stringify(p)} is not repo-relative`;
  if (TREE_RESERVED.has(p))
    return `reserved scaffold file ${JSON.stringify(p)} cannot be a generated tree file`;
  const parts = p.split("/");
  if (parts.some((seg) => !seg || seg === "." || seg === ".."))
    return `path ${JSON.stringify(p)} contains an empty or traversal (..) segment`;
  if (parts.some((seg) => !TREE_SEGMENT.test(seg)))
    return `path ${JSON.stringify(p)} contains an unsafe segment (allowed: [A-Za-z0-9._-])`;
  if (!TREE_ALLOWED_ROOTS.some((root) => p.startsWith(root)))
    return `path ${JSON.stringify(p)} is outside the scaffold's src/ subdirs and tests/`;
  return null;
}

/** Valid TS identifier from arbitrary text (never empty → `_`). */
function ident(raw: string, fallback = "value"): string {
  const base = String(raw ?? "").trim();
  let out = (base || fallback)
    .replace(/[^A-Za-z0-9_$]/g, "_")
    .replace(/^[0-9]+/, "_$&");
  if (!/^[A-Za-z_$]/.test(out)) out = `_${out}`;
  const reserved = new Set([
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "debugger",
    "default",
    "delete",
    "do",
    "else",
    "enum",
    "export",
    "extends",
    "false",
    "finally",
    "for",
    "function",
    "if",
    "import",
    "in",
    "instanceof",
    "new",
    "null",
    "return",
    "super",
    "switch",
    "this",
    "throw",
    "true",
    "try",
    "typeof",
    "var",
    "void",
    "while",
    "with",
  ]);
  return reserved.has(out) ? `_${out}` : out;
}

/** PascalCase identifier (schema entity names, etc.). */
function pascal(raw: string): string {
  const i = ident(raw, "Entity");
  return `${i[0].toUpperCase()}${i.slice(1)}`;
}

/** Deterministic fence for a code block that may itself contain backticks. */
function fence(body: string): string {
  return body.includes("```") ? "````" : "```";
}

/**
 * fixes/135 (bootability): HTML-escape one line of text for an emitted
 * index.html <title>/<h1> insert. Only the five HTML metacharacters are
 * escaped; everything else passes through (the text is also collapse()'d so a
 * hostile project name can never smuggle markup or newlines into the page).
 */
function htmlLine(raw: string, cap = 120): string {
  return mdLine(raw, cap)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Relative ESM import specifier from one emitted file's directory to a
 * target emitted path, WITHOUT the trailing extension (bundler/node
 * resolution pick the real file; node --test callers re-add ".ts" via
 * tsImportPath below). Both paths are sanitized safe segments by the time
 * this runs, so the computation is pure string algebra: drop the shared
 * leading segments, then one "../" per remaining "from" segment.
 */
function relSpecifier(fromDir: string, toPath: string): string {
  const from = String(fromDir ?? "")
    .split("/")
    .filter((s) => s && s !== ".");
  const to = String(toPath ?? "")
    .split("/")
    .filter((s) => s && s !== ".");
  let i = 0;
  while (i < from.length && i < to.length - 1 && from[i] === to[i]) i += 1;
  const ups = from.length - i;
  const rest = to.slice(i).join("/").replace(/\.[A-Za-z0-9]+$/, "");
  const base = ups > 0 ? `${"../".repeat(ups)}${rest}` : `./${rest}`;
  return base.replace(/\/$/, "");
}

/** The import specifier node --test needs: relSpecifier + the real extension. */
function tsImportPath(fromDir: string, toPath: string): string {
  // relSpecifier strips the trailing extension; node --test (strip-types)
  // resolves ESM imports only when the REAL file extension is present, so
  // re-append the stripped .ts/.mts/.cts (the only extensions this emitter
  // ever imports — .tsx modules are never imported from specs).
  const hadExt = /\.[A-Za-z0-9]+$/.test(String(toPath ?? ""));
  const ext = hadExt ? String(toPath).match(/\.[A-Za-z0-9]+$/)?.[0] ?? "" : ".ts";
  return `${relSpecifier(fromDir, toPath)}${ext}`;
}

/**
 * fixes/135: is this generatedSource the deterministic P6 engine template
 * (sandbox.runGenerated's own shape contract)? Only that module is safe to
 * gain a machine-appended export surface — keyed/model modules keep their own
 * shape and are never touched. The three names the surface exports must all
 * exist for the append to be legal.
 */
function isTemplateModule(source: string): boolean {
  const src = String(source ?? "");
  return (
    src.startsWith("const JOBS = [") &&
    /\bconst REJECTION =/.test(src) &&
    /\bfunction synthesize\s*\(/.test(src)
  );
}

/** Export-surface tail appended AFTER a hosted template module (see above). */
const TEMPLATE_EXPORT_TAIL =
  "// Machine export surface (scaffold emitter, fixes/135): the P6 template's\n" +
  "// top-level names, exported so tests/oracle.spec.ts can assert the module's\n" +
  "// REAL behavior. Not part of generatedSource — regenerating the scaffold\n" +
  "// restores this line automatically.\n" +
  "export { JOBS, REJECTION, synthesize };\n";

/** Unique-name allocator mirroring vault.ts titleTaker (first wins, then " (2)"). */
function nameTaker(): (base: string) => string {
  const seen = new Set<string>();
  return (base: string): string => {
    let candidate = base;
    let n = 2;
    while (seen.has(candidate)) {
      candidate = `${base}_${n}`;
      n += 1;
    }
    seen.add(candidate);
    return candidate;
  };
}

/** Deterministic ISO stamp from a project-derived epoch (no Date.now()). */
function iso(ts?: number): string {
  return typeof ts === "number" && Number.isFinite(ts) && ts > 0
    ? new Date(ts).toISOString()
    : "n/a";
}

/** One-line, markdown-safe title-ish string (name/brief/notes inserts). */
function mdLine(raw: string, cap = 200): string {
  const c = collapse(raw);
  return c.length > cap ? `${c.slice(0, cap).trimEnd()}…` : c;
}

// ---------------------------------------------------------------------------
// Kind resolution (E-15 #1: Project.kind — explicit field wins, else infer)
// ---------------------------------------------------------------------------

// Project.kind (types.ts, E-15 wave) is a coarse, optional 3-way union —
// "app" | "tool" | "game" — that consumers map onto their own taxonomy.
// projectKindOf maps it onto this module's 5-way scaffold taxonomy (declared
// kind always wins), then falls back to register keyword inference over
// brief/domain/jobs (E-15 #1) and finally to "webapp".
export function projectKindOf(project: Project): ProjectKind {
  if (project.kind === "game") return "game";
  if (project.kind === "app") return "webapp";
  if (project.kind === "tool") return "cli-tool";
  // Word-token matching (never substring: "TypeScript" must not hit the
  // cli-tool keyword "script", "build" must not hit webapp's "ui").
  const words = new Set(
    [project.brief, project.domain, project.lattice?.jobs?.join(" ") ?? ""]
      .join(" ")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );
  for (const kind of KIND_ORDER) {
    if (KIND_KEYWORDS[kind].some((kw) => words.has(kw))) return kind;
  }
  return "webapp";
}

// ---------------------------------------------------------------------------
// Per-kind static content (constants — never derived from project text, so
// .env.example can never leak project content)
// ---------------------------------------------------------------------------

const ENV_LINES: Record<ProjectKind, string[]> = {
  webapp: ["VITE_API_BASE_URL", "VITE_API_KEY"],
  game: ["VITE_API_BASE_URL"],
  "cli-tool": ["API_BASE_URL", "API_KEY"],
  library: ["API_BASE_URL", "API_KEY"],
  service: ["API_BASE_URL", "API_KEY", "PORT"],
};

const ENV_MEANING: Record<string, string> = {
  VITE_API_BASE_URL:
    "base URL of any backend the UI talks to (local-first: point it at your local dev server)",
  VITE_API_KEY: "client-facing key — PLACEHOLDER, never commit a real one",
  API_BASE_URL: "base URL of any external API the tool talks to (local-first)",
  API_KEY: "API credential — PLACEHOLDER, never commit a real one",
  PORT: "port the service listens on locally",
};

function envExample(kind: ProjectKind): string {
  return [
    "# RapidTool scaffold .env.example — PLACEHOLDER values ONLY (never commit real",
    "# secrets). Copy to .env and fill real values locally; the scaffold is local-first",
    "# and nothing here deploys anywhere by itself.",
    ...ENV_LINES[kind].map((name) => `${name}=PLACEHOLDER`),
    "",
  ].join("\n");
}

const PKG_DEPS: Partial<Record<ProjectKind, Record<string, string>>> = {
  webapp: { react: "^19.0.0", "react-dom": "^19.0.0" },
};

const PKG_DEV_DEPS: Partial<Record<ProjectKind, Record<string, string>>> = {
  webapp: {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    tailwindcss: "^4.0.0",
    typescript: "^5.7.0",
    vite: "^7.0.0",
  },
  game: { "@types/node": "^22.0.0", typescript: "^5.7.0", vite: "^7.0.0" },
  "cli-tool": { "@types/node": "^22.0.0", tsx: "^4.19.0", typescript: "^5.7.0" },
  library: { "@types/node": "^22.0.0", typescript: "^5.7.0" },
  service: { "@types/node": "^22.0.0", tsx: "^4.19.0", typescript: "^5.7.0" },
};

// PKG_SCRIPTS honesty (fixes/149 P1-2 / fixes/150 G3): the dev/build scripts
// below are DECLARED on every emitted tree of the kind. They are only
// VERIFIED when the caller runs `emit --verify-kind` (scratch npm install +
// the declared build, bounded); without that opt-in flag they are unverified
// scaffold claims — declare-or-strike.
const PKG_SCRIPTS: Partial<Record<ProjectKind, Record<string, string>>> = {
  webapp: {
    dev: "vite",
    build: "vite build",
    preview: "vite preview",
    typecheck: "tsc --noEmit",
    test: "node --experimental-strip-types --test tests/oracle.spec.ts",
  },
  game: {
    dev: "vite",
    build: "vite build",
    preview: "vite preview",
    typecheck: "tsc --noEmit",
    test: "node --experimental-strip-types --test tests/oracle.spec.ts",
  },
  "cli-tool": {
    typecheck: "tsc --noEmit",
    test: "node --experimental-strip-types --test tests/oracle.spec.ts",
  },
  library: {
    typecheck: "tsc --noEmit",
    test: "node --experimental-strip-types --test tests/oracle.spec.ts",
  },
  service: {
    typecheck: "tsc --noEmit",
    test: "node --experimental-strip-types --test tests/oracle.spec.ts",
  },
};

function packageJson(kind: ProjectKind, project: Project, hasTests: boolean): string {
  const scripts = { ...(PKG_SCRIPTS[kind] ?? {}) };
  if (!hasTests) delete scripts.test;
  const pkg: Record<string, unknown> = {
    name: slugName(project.name),
    version: "0.0.0",
    private: kind !== "library",
    type: "module",
    description: collapse(project.brief).slice(0, 160) || `RapidTool scaffold (kind ${kind})`,
    scripts,
    dependencies: PKG_DEPS[kind] ?? {},
    devDependencies: PKG_DEV_DEPS[kind] ?? {},
    engines: { node: ">=22" },
    generatedBy: `RapidTool scaffold emitter — ${MACHINE_STAMP(project.id)}`,
    rapidtool: {
      producer: isTemplateModule(String(project.generatedSource ?? ""))
        ? "template"
        : Array.isArray(project.generatedTree) && project.generatedTree.length > 0
          ? "llm"
          : "floor",
      packetId: project.id,
    },
  };
  return `${JSON.stringify(pkg, null, 2)}\n`;
}

function tsconfigJson(kind: ProjectKind, hasTests: boolean): string {
  const dom = kind === "webapp" || kind === "game";
  const lib = dom ? ["ES2022", "DOM", "DOM.Iterable"] : ["ES2022"];
  const cfg = {
    compilerOptions: {
      target: "ES2022",
      lib,
      module: "ESNext",
      moduleResolution: "bundler",
      allowImportingTsExtensions: true,
      isolatedModules: true,
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      types: kind === "webapp" ? ["vite/client", "node"] : ["node"],
      ...(kind === "webapp" ? { jsx: "react-jsx" } : {}),
    },
    include: hasTests ? ["src", "tests"] : ["src"],
  };
  return `${JSON.stringify(cfg, null, 2)}\n`;
}

// ---------------------------------------------------------------------------
// Spec-graph node stubs (E-15 #2) — typed skeletons per node, in topo order
// ---------------------------------------------------------------------------

const TS_FIELD_TYPES: Record<string, string> = {
  ulid: "string",
  string: "string",
  enum: "string",
  datetime: "string",
  date: "string",
  text: "string",
  int: "number",
  float: "number",
  bool: "boolean",
  boolean: "boolean",
  json: "unknown",
};

/** Map a contract field type ("ulid?", "int", …) to a TS type. */
function tsFieldType(raw: string): string {
  const t = String(raw ?? "").trim();
  const nullable = t.endsWith("?");
  const mapped = TS_FIELD_TYPES[t.replace(/\?$/, "").toLowerCase()] ?? "string";
  return nullable ? `${mapped} | null` : mapped;
}

/** Header comment block shared by every emitted source file. */
function sourceHeader(
  path: string,
  purpose: string,
  project: Project,
  extra: string[] = [],
): string[] {
  return [
    "// ---------------------------------------------------------------------------",
    `// ${path} — ${prose(purpose)}`,
    `// ${MACHINE_STAMP(project.id)}`,
    ...extra,
    "// ---------------------------------------------------------------------------",
    "",
  ];
}

/** schema node: domain types from contracts.entities/fields (A6). */
function emitSchema(node: { file: string; purpose: string }, project: Project): string {
  const entities = project.contracts?.entities ?? [];
  const lines = [
    ...sourceHeader(node.file, node.purpose, project, [
      "// Typed entities from the A6 data contract. TODO(E-15) stub: extend fields,",
      "// add per-entity invariants, and keep in sync with the store + api stubs.",
    ]),
  ];
  if (!entities.length) {
    lines.push(
      "// No contract entities recorded yet — complete the P0/P1 phases to",
      "// synthesize the A6 data contract.",
      "export {};",
      "",
    );
  }
  const take = nameTaker();
  for (const entity of entities) {
    const name = take(pascal(entity.name));
    lines.push(`export interface ${name} {`);
    const fields = Array.isArray(entity.fields) ? entity.fields : [];
    if (!fields.length) {
      lines.push("  // TODO(E-15) stub: fields per the lattice entity", `  id: string;`);
    }
    // Duplicate/colliding field identifiers (same field twice, or hostile
    // names that sanitize onto the same identifier) would emit duplicate
    // interface members — a TS2300 error that breaks `npm run typecheck` on
    // the scaffolded tree. First occurrence wins; later duplicates are
    // skipped (the source contract is corrupt; nothing is invented).
    const taken = new Set<string>();
    for (const f of fields) {
      if (f === null || typeof f !== "object") continue;
      const fieldName = ident(f.name, "field");
      if (taken.has(fieldName)) continue;
      taken.add(fieldName);
      lines.push(`  /** ${prose(f.name)} (contract type ${prose(f.type)}) */`);
      lines.push(`  ${fieldName}: ${tsFieldType(f.type)};`);
    }
    lines.push("}", "");
  }
  return lines.join("\n");
}

/** api node: endpoint skeletons from contracts.endpoints (A6). */
function emitApi(node: { file: string; purpose: string }, project: Project): string {
  const endpoints = project.contracts?.endpoints ?? [];
  const lines = [
    ...sourceHeader(node.file, node.purpose, project, [
      "// HTTP contracts bound to jobs. TODO(E-15) stub: implement each endpoint",
      "// against the store stubs; tests/oracle.spec.ts names the oracle expectations.",
    ]),
    `export type EndpointMethod = "GET" | "POST" | "PATCH";`,
    `export type Endpoint = { method: EndpointMethod; path: string; job: string };`,
    "",
    `export const ENDPOINTS: Endpoint[] = [`,
    ...(endpoints.length
      ? endpoints.map(
          (e) => `  { method: ${jstr(e.method)}, path: ${jstr(e.path)}, job: ${jstr(e.job)} },`,
        )
      : [`  // TODO(E-15) stub: no endpoints recorded — complete P0/P1 (A6 synthesizer).`]),
    `];`,
    "",
    `export async function route(`,
    `  method: EndpointMethod,`,
    `  path: string,`,
    `  input: unknown,`,
    `): Promise<{ ok: boolean }> {`,
    `  void input;`,
    `  throw new Error(\`TODO(E-15) stub: implement \${method} \${path}\`);`,
    `}`,
    "",
  ];
  return lines.join("\n");
}

/** store node: checkpoint-store stub (P1/P2 checkpoint contract). */
function emitStore(node: { file: string; purpose: string }, project: Project): string {
  return [
    ...sourceHeader(node.file, node.purpose, project, [
      "// Checkpointed state stub. TODO(E-15) stub: wire hydration from",
      "// .rapidtool/project.json and keep every control bound to a named field.",
    ]),
    `export type Checkpoint = { phase: number; status: string; updatedAt: string };`,
    "",
    `export class CheckpointStore {`,
    `  private readonly checkpoints = new Map<number, Checkpoint>();`,
    "",
    `  write(checkpoint: Checkpoint): void {`,
    `    this.checkpoints.set(checkpoint.phase, { ...checkpoint });`,
    `  }`,
    "",
    `  read(phase: number): Checkpoint | undefined {`,
    `    return this.checkpoints.get(phase);`,
    `  }`,
    `}`,
    "",
  ].join("\n");
}

/** Oracle expectation comment lines for a job label (A7 rows, E-08 seed format). */
function oracleExpectations(project: Project, jobLabel: string | null): string[] {
  if (!jobLabel) return [];
  const rows = project.oracle.filter((row) => row.job === jobLabel);
  if (!rows.length) return [`  // no oracle rows recorded for this job yet`];
  return rows.map(
    (row) => `  // # ${row.id} ${row.name} — ${prose(row.given)} => ${prose(row.expect)}`,
  );
}

/** job-N node: contract-header stub naming oracle expectations. */
function emitJobStub(
  node: { file: string; purpose: string; id: string },
  project: Project,
  jobLabel: string | null,
): string {
  const label = jobLabel ?? node.id;
  return [
    ...sourceHeader(node.file, node.purpose, project, [
      "// TODO(E-15) stub: implement the job contract below. Oracle expectations",
      "// this module must satisfy:",
      ...oracleExpectations(project, jobLabel),
    ]),
    `export function run${pascal(node.id)}(input: unknown): { ok: boolean } {`,
    `  void input;`,
    `  throw new Error(${jstr(`TODO(E-15) stub: implement job ${label}`)});`,
    `}`,
    "",
  ].join("\n");
}

/** Host file for the machine-verified P6 module: header + generatedSource verbatim. */
function emitGeneratedHost(
  node: { file: string; purpose: string; id: string },
  project: Project,
  source: string,
): string {
  const hostLines = [
    ...sourceHeader(node.file, node.purpose, project, [
      "// This file hosts the machine-verified P6 synthesis module (project.generatedSource),",
      "// verbatim below. Its self-tests ran inside the engine isolate at P6 — keep them",
      "// green when you implement the surrounding jobs.",
    ]),
    source.trim(),
    "",
  ];
  // fixes/135 (real oracle tests): when the hosted module is the deterministic
  // P6 engine template, expose its top-level names so tests/oracle.spec.ts can
  // assert the module's real behavior (JOBS/synthesize/REJECTION). The tail is
  // added AFTER the verbatim source — generatedSource itself is untouched and
  // keyed/model modules (which carry their own export shape) never get it.
  if (isTemplateModule(source)) hostLines.push(TEMPLATE_EXPORT_TAIL);
  return hostLines.join("\n");
}

/**
 * fixes/144 (M2): a spec-graph node file the generated tree does NOT cover.
 * In tree mode the node materializes as a THIN RE-EXPORT of the tree's ENTRY
 * module, so every graph path the scaffold promised still exists + resolves,
 * while all real code stays in the tree files — never a TODO(E-15) stub
 * sitting next to a real implementation. `path` is the SANITIZED emitted path
 * (safeNodePath output), never raw node.file text. The relative specifier
 * keeps the real extension (node --test strip-types and the emitted tsconfig's
 * allowImportingTsExtensions both resolve it).
 */
function emitTreeBridge(
  node: { file: string; purpose: string; id: string },
  project: Project,
  entryPath: string,
): string {
  const slash = node.file.lastIndexOf("/");
  const fromDir = slash > 0 ? node.file.slice(0, slash) : ".";
  return [
    ...sourceHeader(node.file, node.purpose, project, [
      "// fixes/144 (M2) tree bridge: the generated tree ships no file at this spec-graph",
      `// path, so this module re-exports the tree ENTRY module (${entryPath}) verbatim —`,
      "// real generated code, not a TODO stub. Align this node's file with a tree path",
      "// (or regenerate the tree) to replace the bridge.",
    ]),
    `export * from ${jstr(tsImportPath(fromDir, entryPath))};`,
    "",
  ].join("\n");
}

/** ui node: kind-appropriate shell (webapp → React; game → canvas; else CLI-ish TS). */
function emitUi(
  node: { file: string; purpose: string },
  project: Project,
  kind: ProjectKind,
): string {
  if (kind === "webapp") {
    return [
      ...sourceHeader(node.file, node.purpose, project, [
        "// Operator surfaces bound to store fields (P8 interface contract).",
        "// Shell only — implementing the surfaces named in the project's",
        '// "Interface contract" artifact is the human/agent build work ahead.',
      ]),
      `import { useState } from "react";`,
      "",
      `export function Console() {`,
      `  const [notice] = useState<string>(`,
      `    "shell — implement the P8 interface-contract surfaces against the store stubs",`,
      `  );`,
      `  return (`,
      `    <main>`,
      `      <h1>{${jstr(prose(project.name))}}</h1>`,
      `      <p>{notice}</p>`,
      `    </main>`,
      `  );`,
      `}`,
      "",
      `export default Console;`,
      "",
    ].join("\n");
  }
  if (kind === "game") {
    return [
      ...sourceHeader(node.file, node.purpose, project, [
        "// Game shell (canvas). Assets are NOT engine-generated — see",
        "// assets/manifest.json for the expected placeholder art roster.",
      ]),
      `export type GameHandle = { stop: () => void };`,
      "",
      `export function bootGame(root: HTMLElement): GameHandle {`,
      `  const canvas = document.createElement("canvas");`,
      `  root.appendChild(canvas);`,
      `  // TODO(E-15) stub: render loop + input per the lattice entities and the`,
      `  // asset roster in assets/manifest.json.`,
      `  return {`,
      `    stop: () => {`,
      `      canvas.remove();`,
      `    },`,
      `  };`,
      `}`,
      "",
    ].join("\n");
  }
  const flavor =
    kind === "service"
      ? [
          `export type ServiceContext = { env: Record<string, string> };`,
          "",
          `export async function main(ctx: ServiceContext): Promise<number> {`,
          `  void ctx;`,
          `  throw new Error("TODO(E-15) stub: implement the service entry");`,
          `}`,
          "",
        ]
      : [
          `export type CliContext = { argv: string[]; env: Record<string, string> };`,
          "",
          `export async function main(ctx: CliContext): Promise<number> {`,
          `  void ctx;`,
          `  throw new Error("TODO(E-15) stub: implement the console entry per the oracle");`,
          `}`,
          "",
        ];
  return [
    ...sourceHeader(node.file, node.purpose, project, [
      "// Console/entry shell — contract-level (P8). Wire it to the job modules",
      "// under src/jobs/ as you implement them.",
    ]),
    ...flavor,
  ].join("\n");
}

/**
 * Emitted-module surface context for the oracle spec: the sanitized paths the
 * emitter actually wrote (or null when the graph has no such node). Only .ts
 * modules are ever imported (node:test strip-types cannot load .tsx/JSX).
 */
type OracleSurfaceCtx = {
  /** store node module path (exports CheckpointStore). */
  storePath?: string | null;
  /** api node module path (exports ENDPOINTS + route). */
  apiPath?: string | null;
  /** path hosting generatedSource (template-shaped modules get an export tail). */
  hostPath?: string | null;
  /**
   * fixes/144 (M2): tree assembly mode — path of the generatedTree ENTRY
   * module (the file at the path the legacy P6 host would have used). When
   * set, the spec imports ONLY the tree (store/api/template surfaces are
   * generated content with unknown export names) and asserts the entry loads
   * with a non-empty namespace — real cross-file imports resolved by node.
   */
  treeEntryPath?: string | null;
  /** Sorted accepted tree paths (for the emitted file-list comment). */
  treePaths?: string[];
};

// ---------------------------------------------------------------------------
// fixes/150 (G2) — capability-presence demands (SEMANTIC-FAILURE REPAIR).
//
// The single, deterministic capability set shared by TWO consumers so they can
// never drift apart:
//   1. the emitted tests/oracle.spec.ts capability-presence rows (below —
//      one REAL test per demanded capability, red when the capability's
//      identifier is absent from the emitted tree); and
//   2. headless driveP6Journey's coverage gate (capabilityCoverage over the
//      synthesized tree BEFORE declaring convergence).
// The source order mirrors dod.archCapabilities (p6-arch): the expanded
// spec's typeSignatures first (each demands its declared primary export
// name), then implementationSpec.requirements (each sentence's content
// tokens). A project WITHOUT an implementationSpec carries NO capability
// demands — those emissions stay byte-identical (the fixes/150 byte-parity
// pin). Capability labels are NOT oracle rows: they assert identifier
// PRESENCE ONLY — a proxy, never behavioral proof (the emitted row's assert
// message says exactly what it checks).
// ---------------------------------------------------------------------------

/** One demanded capability: `label` is the human prose (requirement sentence
 *  or signature line), `demand` is the coverage label capabilityCoverage
 *  receives (the declared export name for a typeSignature — whose own token
 *  forms equal `forms` — or the requirement text, whose formsForCapability
 *  form set is a superset of the stopword-filtered `forms`, so a row can
 *  only ever be STRICTER than the gate, never a false red), and `forms` are
 *  the demanded identifier/stem forms the emitted row embeds as literals. */
export type CapabilityDemand = {
  label: string;
  demand: string;
  forms: string[];
};

/** Demanded identifier forms for one capability text: lowercased content
 *  tokens (stopword-filtered, identifier-valid, len>1) + their canonical
 *  stems — the maker-score capabilityCoverage / dod p6-arch matching
 *  semantics (sub-identifier, case-insensitive). Deliberately stopword-free:
 *  a row must never pass on a junk word ("the"/"with") living in a name. */
export function capabilityPresenceForms(text: string): string[] {
  const raw = String(text ?? "").toLowerCase();
  const tokens = raw.split(/[^a-z0-9_$]+/).filter((t) => t.length > 1);
  const out: string[] = [];
  for (const t of tokens) {
    if (BRIEF_STOPWORDS.has(t)) continue;
    if (!/^[a-z_$][a-z0-9_$]*$/.test(t)) continue;
    if (!out.includes(t)) out.push(t);
    const st = canonicalStem(t);
    if (st && st.length > 1 && st !== t && !out.includes(st)) out.push(st);
  }
  return out;
}

/** Primary declared name a typeSignature line demands — the dod.ts
 *  p6-arch parser, mirrored verbatim so the emitted rows and the DoD probe
 *  agree on what a signature demands: `export function createBoard(…)` →
 *  createBoard; `export type Order = …` → Order; bare `createOrder(items)`
 *  → createOrder. Null when nothing parses (the line then demands its
 *  content forms instead). */
function primarySignatureName(sig: string): string | null {
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

/** The project's demanded capabilities — [] when the project carries no
 *  implementationSpec (keyless/deterministic floors: nothing demanded, no
 *  rows, byte parity) or when every line tokenizes to zero content forms. */
export function capabilityDemands(project: Project): CapabilityDemand[] {
  if (project == null || typeof project !== "object") return [];
  const spec = project.implementationSpec;
  if (spec == null || typeof spec !== "object") return [];
  const sigs = Array.isArray(spec.typeSignatures)
    ? spec.typeSignatures.map((s) => String(s).trim()).filter((s) => s.length > 0)
    : [];
  const reqs = Array.isArray(spec.requirements)
    ? spec.requirements.map((s) => String(s).trim()).filter((s) => s.length > 0)
    : [];
  const src = sigs.length > 0 ? sigs : reqs;
  const out: CapabilityDemand[] = [];
  for (const line of src) {
    const primary = sigs.length > 0 ? primarySignatureName(line) : null;
    const demand = primary ?? line;
    // Signature demand = the declared export name; its own token forms are
    // exactly the forms the row embeds. Requirement demand = the sentence,
    // with stopword-filtered content forms (the gate's form set ⊇ these).
    const forms =
      primary !== null
        ? capabilityPresenceForms(primary)
        : capabilityPresenceForms(line);
    if (forms.length === 0) continue;
    out.push({ label: line, demand, forms });
  }
  return out;
}

/**
 * tests node: tests/oracle.spec.ts — REAL assertions over the emitted modules
 * (fixes/135). No todo stubs: every A7 oracle row keeps its PINNED orc-* id as
 * a test name (E-08 — never rename or drop one) and every test asserts what
 * the modules the scaffold actually ships DO today:
 *   - the generated P6 module's own functions are asserted when the
 *     deterministic template hosts them (synthesize/JOBS/REJECTION);
 *   - store/api modules are asserted over their real exports
 *     (CheckpointStore round-trips, ENDPOINTS ↔ A6 contract equality);
 *   - an oracle row whose target seam is a TODO(E-15) stub asserts that the
 *     seam REJECTS — an honest statement of the current surface that FAILS
 *     the moment the seam is implemented (that is the signal to replace it
 *     with the row's real acceptance assertion);
 *   - nothing here pretends a stub satisfies its brief.
 */
function emitOracleSpec(project: Project, ctx: OracleSurfaceCtx = {}): string {
  const rows = Array.isArray(project.oracle) ? project.oracle : [];
  const contracts =
    project.contracts !== null && typeof project.contracts === "object"
      ? (project.contracts as { entities?: unknown[]; endpoints?: { method: string; path: string; job: string }[] })
      : null;
  const endpoints = Array.isArray(contracts?.endpoints) ? contracts.endpoints : [];
  const latticeJobs = Array.isArray(project.lattice?.jobs) ? project.lattice.jobs : [];
  const generated = String(project.generatedSource ?? "").trim();
  const template = isTemplateModule(generated);
  // fixes/144 (M2): tree assembly mode — the caller names the tree ENTRY module
  // path (only .ts entries are importable under node strip-types, mirroring the
  // legacy host import rule; .tsx tree files stay emitted but never imported).
  const treeEntryOk =
    typeof ctx.treeEntryPath === "string" && /\.ts$/.test(ctx.treeEntryPath);
  const storeOk =
    !treeEntryOk && typeof ctx.storePath === "string" && /\.ts$/.test(ctx.storePath);
  const apiOk =
    !treeEntryOk && typeof ctx.apiPath === "string" && /\.ts$/.test(ctx.apiPath);
  const hostOk =
    !treeEntryOk && typeof ctx.hostPath === "string" && /\.ts$/.test(ctx.hostPath) && template;
  // Mirror the engine's P6 module build: lattice jobs (≤5) or ["core"].
  const expectedJobs = latticeJobs.length ? latticeJobs.slice(0, 5) : ["core"];
  const expectedJson = (v: unknown): string => JSON.stringify(v);
  // fixes/150 (G2): capability-presence row state. Rows exist ONLY when the
  // project carries an implementationSpec with demanded capabilities AND an
  // emitted module surface exists to scan (the tree files in tree mode, else
  // the hosted module path). A project with no capability/requirement rows
  // emits byte-identical output (the fixes/150 byte-parity pin).
  const capDemands = capabilityDemands(project);
  const capScanPaths: string[] =
    capDemands.length > 0
      ? treeEntryOk
        ? (Array.isArray(ctx.treePaths) ? ctx.treePaths : []).map((p) => tsImportPath("tests", p))
        : typeof ctx.hostPath === "string" && /\.[cm]?ts$/.test(ctx.hostPath)
          ? [tsImportPath("tests", ctx.hostPath)]
          : []
      : [];
  const capSection = capDemands.length > 0 && capScanPaths.length > 0;

  const lines = [
    "// ---------------------------------------------------------------------------",
    "// tests/oracle.spec.ts — acceptance tests from the A7 oracle (project.oracle)",
    `// ${MACHINE_STAMP(project.id)}`,
    "// REAL assertions, no todo stubs (fixes/135). Row ids are PINNED: the verify",
    "// harness seeds + pins orc-* ids across runs (E-08) — never rename or drop",
    "// one. Each test asserts what the emitted modules ACTUALLY do today:",
    "//   * where the generated P6 module defines functions (the deterministic",
    "//     template's synthesize/JOBS/REJECTION), those are asserted directly;",
    "//   * store/api modules are asserted over their real exports;",
    "//   * an oracle row whose target seam is a TODO(E-15) stub asserts the seam",
    "//     rejects — that test FAILS the moment the seam is implemented, which is",
    "//     the signal to replace it with the row's real acceptance assertion;",
    "//   * nothing here pretends a stub satisfies its brief.",
    "// Run: node --experimental-strip-types --test tests/oracle.spec.ts",
    ...(treeEntryOk
      ? [
          "// TREE mode (fixes/144 M2): this project carries a generatedTree, so the",
          "// scaffold assembled those files (verbatim, at their own paths) instead of",
          "// the single P6 module; section 1 imports the tree ENTRY module below.",
        ]
      : []),
    ...(capSection
      ? [
          "// Capability-presence rows (fixes/150 G2) ride section 5 below: one REAL",
          "// test per capability the implementationSpec demands (typeSignatures",
          "// first, requirements fallback — the p6-arch source order).",
        ]
      : []),
    "// ---------------------------------------------------------------------------",
    `import { test } from "node:test";`,
    `import assert from "node:assert/strict";`,
    ...(capSection
      ? [
          'import { readFileSync } from "node:fs";',
          'import { join } from "node:path";',
          'import { fileURLToPath } from "node:url";',
        ]
      : []),
    ...(storeOk ? [`import { CheckpointStore } from ${jstr(tsImportPath("tests", ctx.storePath as string))};`] : []),
    ...(apiOk ? [`import { ENDPOINTS, route } from ${jstr(tsImportPath("tests", ctx.apiPath as string))};`] : []),
    ...(hostOk ? [`import { JOBS, REJECTION, synthesize } from ${jstr(tsImportPath("tests", ctx.hostPath as string))};`] : []),
    ...(treeEntryOk
      ? [`import * as treeModule from ${jstr(tsImportPath("tests", ctx.treeEntryPath as string))};`]
      : []),
    "",
  ];

  // --- 1. Tree truth (fixes/144 M2) — the generated tree ENTRY module ------
  // In tree mode the spec imports the tree's entry (the file at the path the
  // legacy P6 host would have used — same selection rule). Loading the spec
  // therefore loads the entry AND every module it imports: real cross-file
  // imports genuinely resolve under node:test. Export NAMES are generated
  // content (unknown at emit time), so the entry is asserted as a namespace.
  if (treeEntryOk) {
    const treePaths = Array.isArray(ctx.treePaths) ? ctx.treePaths : [];
    lines.push(
      "// ---------------------------------------------------------------------------",
      "// 1. Tree truth — the generated tree ENTRY module (project.generatedTree,",
      "// fixes/144 M2). The scaffold assembled every tree file verbatim at its own",
      "// repo-relative path; this spec imports the ENTRY module (the file at the",
      "// path the legacy P6 host would have used) so the emitted npm test executes",
      "// the REAL generated tree — its cross-file imports must resolve or this spec",
      "// fails to load. Export names are generated content, so the entry is asserted",
      "// as a namespace that must carry at least one real export.",
      "// ---------------------------------------------------------------------------",
      "",
      "// Emitted generated-tree files:",
      ...treePaths.map((p) => `//   ${p}${p === ctx.treeEntryPath ? "  (entry)" : ""}`),
      "",
      "test(\"tree.entry — the generated tree entry module loads and cross-file imports resolve\", () => {",
      "  assert.ok(treeModule, \"entry namespace present after import\");",
      "  assert.equal(typeof treeModule, \"object\");",
      "  const names = Object.keys(treeModule);",
      '  assert.ok(names.length > 0, "entry exports real names: " + names.join(", "));',
      "});",
      "",
    );
  }

  // --- 1. Module truth — the deterministic P6 template's real behavior ------
  if (hostOk) {
    lines.push(
      "// ---------------------------------------------------------------------------",
      "// 1. Module truth — the hosted P6 module (project.generatedSource), verbatim.",
      "// ---------------------------------------------------------------------------",
      "",
    );
    if (latticeJobs.length) {
      lines.push(
        `test("module.jobs — the P6 module lists the lattice jobs in order", () => {`,
        `  assert.deepEqual(JOBS, ${expectedJson(expectedJobs)});`,
        `});`,
        "",
      );
    }
    lines.push(
      `test("module.synthesize — a valid phase + known job returns ok", () => {`,
      `  const out = synthesize({ name: "probe", phase: 6, job: JOBS[0] });`,
      `  assert.equal(out.ok, true);`,
      `  assert.equal(out.job, JOBS[0]);`,
      `  assert.equal(typeof out.addressed, "boolean");`,
      `});`,
      "",
      `test("module.synthesize — an out-of-range phase is rejected", () => {`,
      `  assert.throws(() => synthesize({ name: "x", phase: -1, job: JOBS[0] }), /invalid phase/);`,
      `  assert.throws(() => synthesize({ name: "x", phase: 13, job: JOBS[0] }), /invalid phase/);`,
      `});`,
      "",
      `test("module.synthesize — an unknown job is rejected", () => {`,
      `  assert.throws(() => synthesize({ name: "x", phase: 6, job: "__no_such_job__" }), /unknown job/);`,
      `});`,
      "",
      `test("module.synthesize — the rejection note blocks phase 9 when present", () => {`,
      `  if (REJECTION) {`,
      `    assert.throws(() => synthesize({ name: "x", phase: 9, job: JOBS[0] }), /deploy blocked/);`,
      `    const out = synthesize({ name: "x", phase: 6, job: JOBS[0] });`,
      `    assert.equal(out.addressed, true);`,
      `  } else {`,
      `    const out = synthesize({ name: "x", phase: 9, job: JOBS[0] });`,
      `    assert.equal(out.ok, true);`,
      `    assert.equal(out.addressed, false);`,
      `  }`,
      `});`,
      "",
    );
  }

  // --- 2. Store truth — the real CheckpointStore semantics -----------------
  if (storeOk) {
    lines.push(
      "// ---------------------------------------------------------------------------",
      "// 2. Store truth — CheckpointStore (src/state), the real checkpoint surface.",
      "// ---------------------------------------------------------------------------",
      "",
      `test("store.checkpoint — write then read returns the stored checkpoint", () => {`,
      `  const s = new CheckpointStore();`,
      `  s.write({ phase: 2, status: "sealed", updatedAt: "2026-01-01T00:00:00.000Z" });`,
      `  const got = s.read(2);`,
      `  assert.ok(got, "checkpoint written is checkpoint read");`,
      `  assert.equal(got.phase, 2);`,
      `  assert.equal(got.status, "sealed");`,
      `});`,
      "",
      `test("store.checkpoint — reading an unwritten phase returns undefined", () => {`,
      `  const s = new CheckpointStore();`,
      `  assert.equal(s.read(4), undefined);`,
      `});`,
      "",
      `test("store.checkpoint — a later write for a phase replaces the earlier one", () => {`,
      `  const s = new CheckpointStore();`,
      `  s.write({ phase: 3, status: "draft", updatedAt: "2026-01-01T00:00:00.000Z" });`,
      `  s.write({ phase: 3, status: "sealed", updatedAt: "2026-01-02T00:00:00.000Z" });`,
      `  assert.equal(s.read(3)?.status, "sealed");`,
      `  assert.equal(s.read(3)?.updatedAt, "2026-01-02T00:00:00.000Z");`,
      `});`,
      "",
    );
  }

  // --- 3. Endpoint truth — ENDPOINTS against the A6 contract ---------------
  if (apiOk) {
    lines.push(
      "// ---------------------------------------------------------------------------",
      "// 3. Endpoint truth — ENDPOINTS must match the A6 contract verbatim.",
      "// ---------------------------------------------------------------------------",
      "",
      endpoints.length
        ? `test("api.endpoints — ENDPOINTS matches the A6 contract endpoints", () => {`
        : `test("api.endpoints — no A6 endpoints recorded, ENDPOINTS stays empty", () => {`,
      `  assert.deepEqual(ENDPOINTS, ${expectedJson(endpoints)});`,
      `});`,
      "",
    );
  }

  // --- 4. A7 oracle rows — pinned ids, honest current-surface assertions ----
  lines.push(
    "// ---------------------------------------------------------------------------",
    "// 4. Oracle rows (A7) — one test per row under its PINNED id.",
    "// ---------------------------------------------------------------------------",
    "",
  );
  if (!rows.length) {
    lines.push(
      `test("no-oracle: project has no A7 rows yet — run the pipeline to P0/P1", () => {`,
      `  assert.equal(true, true, "no oracle rows recorded — nothing to assert yet");`,
      `});`,
      "",
    );
  }
  const SEAL_DATE = "2026-01-01T00:00:00.000Z";
  for (const row of rows) {
    if (row === null || typeof row !== "object") continue;
    const id = typeof row.id === "string" ? row.id : "";
    const name = prose(row.name);
    const given = prose(row.given);
    const expect = prose(row.expect);
    const job = prose(row.job);
    const ep = endpoints.find((e) => e.job === row.job);
    const wantsCheckpoint = /checkpoint/i.test(expect);
    lines.push(
      `test(${jstr(id)}, async () => {`,
      `  // A7 row ${jstr(id)} ${name ? `"${name}"` : ""} — ${given} => ${expect}`,
    );
    if (apiOk && ep) {
      lines.push(
        `  // Target seam: ${job} (${ep.method} ${ep.path}). Today it is a TODO(E-15) stub —`,
        `  // the route rejects instead of returning "${expect}". Asserting that real`,
        `  // current behavior: this test FAILS the moment ${job} is implemented,`,
        `  // which is the signal to replace it with the row's real acceptance assert.`,
        `  const ep = ENDPOINTS.find((e) => e.job === ${jstr(row.job)});`,
        `  assert.ok(ep, "endpoint for the row's job must exist (contract drift)");`,
        `  await assert.rejects(route(ep.method, ep.path, {}), /TODO\\(E-15\\) stub/);`,
      );
      if (wantsCheckpoint && storeOk) {
        lines.push(
          `  // The "${expect}" row expects a checkpoint write — the one part the real`,
          `  // CheckpointStore can satisfy today:`,
          `  const s = new CheckpointStore();`,
          `  s.write({ phase: 6, status: "sealed", updatedAt: ${jstr(SEAL_DATE)} });`,
          `  assert.equal(s.read(6)?.status, "sealed");`,
        );
      }
    } else if (hostOk) {
      lines.push(
        `  // Row targets ${job || "the phase graph"} — no HTTP endpoint exists for it. The`,
        `  // only executable rule today is the P6 module's phase bookkeeping: an`,
        `  // out-of-range phase is an illegal transition and is rejected.`,
        `  assert.throws(() => synthesize({ name: "x", phase: 13, job: JOBS[0] }), /invalid phase/);`,
        `  assert.throws(() => synthesize({ name: "x", phase: -1, job: JOBS[0] }), /invalid phase/);`,
      );
    } else {
      lines.push(
        `  // No emitted module surface targets this row yet (no endpoint, no P6`,
        `  // template host). Honest floor: the pinned id + prose are recorded so a`,
        `  // later emit (after P0/P1) upgrades this to a real assertion.`,
        `  assert.ok(${jstr(id)}.length > 0, "row id is pinned");`,
        `  assert.ok(${jstr(name || given || expect)}.length >= 0, "row prose recorded");`,
      );
    }
    lines.push(`});`, "");
  }

  // --- 5. Capability presence (fixes/150 G2) — semantic-failure repair -----
  // One REAL test per capability the project's implementationSpec demands
  // (typeSignatures first, requirements fallback — the same source order
  // dod.p6-arch uses), so capability ABSENCE is a red test, never a post-hoc
  // report. Each row re-reads the emitted files from disk at test time and
  // asserts the capability's demanded identifier forms (content tokens +
  // canonical stems) appear in a file path or source text. Identifier
  // presence is a PROXY — the assert message says exactly what it checks
  // (name/source-text presence) and never claims behavior. The scan runs
  // over RAW source text (comments/literals not masked) — deliberately
  // lenient, so it can never red a tree the engine's masked probe
  // (capabilityCoverage / p6-arch) passes — and re-reads the files on every
  // run, so an edit that removes a capability's identifiers turns its row
  // red the next time the suite runs.
  if (capSection) {
    lines.push(
      "// ---------------------------------------------------------------------------",
      "// 5. Capability presence (fixes/150 G2) — demanded capability identifiers",
      "// must exist in the emitted tree (presence proxy: a name is NOT behavior).",
      "// ---------------------------------------------------------------------------",
      "",
      "// Capability-presence scan: `__capScanFiles` are the emitted files this spec",
      "// may read (tests/ dir → file, via __capDir). __capCarries() is true when the",
      "// file exists AND its path or source text contains one of the demanded forms.",
      "const __capDir = join(fileURLToPath(import.meta.url), \"..\");",
      `const __capScanFiles = ${JSON.stringify(capScanPaths)};`,
      "function __capCarries(relPath: string, forms: string[]): boolean {",
      "  let text = \"\";",
      "  try {",
      "    text = readFileSync(join(__capDir, relPath), \"utf8\");",
      "  } catch {",
      "    return false; // file missing from the emission ⇒ it carries nothing",
      "  }",
      "  const p = relPath.toLowerCase();",
      "  const body = text.toLowerCase();",
      "  return forms.some((f) => f.length > 0 && (p.includes(f) || body.includes(f)));",
      "}",
      "",
    );
    capDemands.forEach((d, i) => {
      const idName = `capability.${i + 1}`;
      lines.push(
        `// ${idName} — ${prose(d.label)}`,
        `test(${jstr(idName)}, () => {`,
        `  // Demanded identifier forms (content tokens + canonical stems;`,
        "  // stopword-free): presence of ANY of them in the scanned files counts.",
        `  const forms = ${JSON.stringify(d.forms)};`,
        "  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));",
        "  assert.ok(",
        "    carried.length > 0,",
        `    ${jstr(`capability presence proxy FAILED: capability "${prose(d.label)}" has NONE of its demanded identifier forms (${d.forms.join(", ")}) in any emitted file — ${capScanPaths.join(", ")}. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior.`)}`,
        "  );",
        "});",
        "",
      );
    });
  }

  // A2 (fixes/162): human-approved brief fixtures — folded into THIS spec
  // (PKG test script pins tests/oracle.spec.ts; a second brief.spec.ts
  // would never run). Partial approval → this section is omitted (byte-identical
  // to the no-fixture emission). Requires a tree entry namespace to call.
  const fxApproved = treeEntryOk ? approvedAcceptanceFixtures(project.acceptanceFixtures) : null;
  if (fxApproved) {
    lines.push(
      "// ---------------------------------------------------------------------------",
      "// 6. Brief-derived acceptance fixtures (fixes/162 A2) — human-approved",
      "// input→output cases. given is JSON-literal. shape = partial match with",
      '// "<draft>"/"<any>" placeholders. throws = substring includes. property',
      "// cases are red-carded (no registry). Never auto-approved.",
      "// ---------------------------------------------------------------------------",
      "",
      "const entry = treeModule;",
      fixtureMatchHelperSource(),
      "",
    );
    for (const fx of fxApproved) {
      const compiled = compileFixtureAssertion(fx);
      const title = `fx.${fx.id} — ${fx.name}`;
      if (!compiled.ok) {
        lines.push(
          `test(${jstr(title)}, () => {`,
          `  assert.fail(${jstr(`fixture ${fx.id} not executable: ${compiled.reason}`)});`,
          "});",
          "",
        );
        continue;
      }
      lines.push(`test(${jstr(title)}, () => {`, compiled.body, "});", "");
    }
  }

  return lines.join("\n");
}

/** Game variant: assets/manifest.json — expected-but-absent art roster (honest). */
function emitGameManifest(project: Project): string {
  const entities = project.contracts?.entities?.length
    ? project.contracts.entities.map((e) => e.name)
    : (project.lattice?.entities ?? []);
  const jobs = project.lattice?.jobs ?? [];
  const roster = new Set<string>();
  const assets: Record<string, unknown>[] = [];
  for (const name of [...entities, ...jobs].slice(0, 12)) {
    const key = segment(name.toLowerCase(), "entity");
    const assetPath = `sprites/${key}.png`;
    if (roster.has(assetPath)) continue;
    roster.add(assetPath);
    assets.push({
      asset: assetPath,
      role: `entity/job placeholder for ${prose(name)}`,
      status: "placeholder",
      note: "NOT engine-generated — supply art or procedural rendering",
    });
  }
  assets.push({
    asset: "ui/icon.png",
    role: "app icon placeholder",
    status: "placeholder",
    note: "NOT engine-generated — supply art or procedural rendering",
  });
  return `${JSON.stringify(
    {
      schema: 1,
      kind: "game",
      generatedBy: `RapidTool scaffold emitter — ${MACHINE_STAMP(project.id)}`,
      note: "Placeholder manifest: assets/ and public/ are expected at the emitted scaffold and are NOT engine-generated.",
      assets,
    },
    null,
    2,
  )}\n`;
}

// ---------------------------------------------------------------------------
// Browser boot files (fixes/135 — webapp/game emits must actually boot)
//
// The webapp/game package.json has always declared `vite` dev/build scripts,
// but the emitted tree carried NO index.html / vite.config / src entry, so
// `npm run build` died with "Could not resolve entry module index.html".
// These three files close that gap: index.html (the vite HTML entry),
// vite.config.ts (webapp: the react plugin the devDeps/tsconfig already
// declare), and a src/main browser entry that mounts the emitted UI shell
// (src/ui — the P8 contract-level shell). All deterministic + escaped.
// ---------------------------------------------------------------------------

/** vite HTML entry. `entryScript` is the /-rooted src path vite must load. */
function emitIndexHtml(project: Project, entryScript: string): string {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "  <head>",
    '    <meta charset="UTF-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    `    <title>${htmlLine(project.name) || "RapidTool scaffold"}</title>`,
    "  </head>",
    "  <body>",
    '    <div id="root"></div>',
    `    <script type="module" src="${entryScript}"></script>`,
    "  </body>",
    "</html>",
    "",
  ].join("\n");
}

/** vite.config.ts — webapp only (react plugin; tsconfig already declares jsx react-jsx). */
function emitViteConfig(): string {
  return [
    "// ---------------------------------------------------------------------------",
    "// vite.config.ts — emitted by the RapidTool scaffold (fixes/135 bootability).",
    "// The webapp package.json declares vite dev/build scripts + the react plugin;",
    "// this config makes them real: index.html + src/main mount the UI shell.",
    "// ---------------------------------------------------------------------------",
    'import { defineConfig } from "vite";',
    'import react from "@vitejs/plugin-react";',
    "",
    "export default defineConfig({",
    "  plugins: [react()],",
    "});",
    "",
  ].join("\n");
}

/**
 * Browser entry that mounts the emitted UI shell. `uiSpecifier` is the
 * extensionless relative import to the sanitized ui node path (null when the
 * spec graph has no ui node — then a self-contained honest shell is emitted).
 * webapp mounts the React Console; game boots the canvas shell.
 */
function emitMainEntry(kind: ProjectKind, project: Project, uiSpecifier: string | null): string {
  if (kind === "webapp") {
    const title = jstr(prose(project.name) || "RapidTool scaffold");
    const lines = [
      ...sourceHeader("src/main.tsx", "Browser entry — mounts the UI shell (P8 interface contract)", project, [
        "// The mounted surface is the contract-level Console shell from src/ui; wiring",
        "// it to the store/job modules is the build work ahead (see README honest",
        "// boundaries).",
      ]),
      'import { createRoot } from "react-dom/client";',
      "",
    ];
    if (uiSpecifier) {
      lines.push(
        `import Console from ${jstr(uiSpecifier)};`,
        "",
        "const rootEl = document.getElementById(\"root\");",
        "if (!rootEl) throw new Error(\"missing #root element — index.html did not load\");",
        "createRoot(rootEl).render(<Console />);",
        "",
      );
    } else {
      lines.push(
        "function Shell() {",
        `  return (`,
        `    <main>`,
        `      <h1>{${title}}</h1>`,
        `      <p>shell — no spec-graph ui node was emitted for this project; run the`,
        `      pipeline to P0/P1 and re-emit to mount the P8 interface contract.</p>`,
        `    </main>`,
        `  );`,
        `}`,
        "",
        "const rootEl = document.getElementById(\"root\");",
        "if (!rootEl) throw new Error(\"missing #root element — index.html did not load\");",
        "createRoot(rootEl).render(<Shell />);",
        "",
      );
    }
    return lines.join("\n");
  }
  // game kind: plain-TS entry, no react dependency (matches the game devDeps).
  const lines = [
    ...sourceHeader("src/main.ts", "Browser entry — boots the game shell", project, [
      "// Assets are NOT engine-generated — see assets/manifest.json.",
    ]),
  ];
  if (uiSpecifier) {
    lines.push(
      `import { bootGame } from ${jstr(uiSpecifier)};`,
      "",
      "const rootEl = document.getElementById(\"root\");",
      "if (!rootEl) throw new Error(\"missing #root element — index.html did not load\");",
      "const handle = bootGame(rootEl);",
      "void handle; // keep the GameHandle reachable for future HMR/dev wiring",
      "",
    );
  } else {
    lines.push(
      "const rootEl = document.getElementById(\"root\");",
      "if (!rootEl) throw new Error(\"missing #root element — index.html did not load\");",
      "rootEl.textContent = \"game shell — no spec-graph ui node was emitted; run the pipeline to P0/P1 and re-emit.\";",
      "",
    );
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// README.md
// ---------------------------------------------------------------------------

function phaseRailRows(project: Project): string[] {
  const rows: string[] = [];
  for (const rec of project.phases) {
    // Junk/hand-built rows fail closed: a null row or one whose gate record
    // lacks the expected fields degrades to an honest "unrecorded" phrasing
    // instead of crashing the whole emitter.
    if (rec === null || typeof rec !== "object") continue;
    const id = rec.id;
    const status = typeof rec.status === "string" ? rec.status : "unrecorded";
    const def = PHASES.find((p) => p.id === id);
    const unmet = rec.gate !== null && typeof rec.gate === "object" && Array.isArray(rec.gate.unmet) ? rec.gate.unmet : [];
    const gate =
      rec.gate == null || typeof rec.gate !== "object"
        ? "gate unrecorded"
        : rec.gate.passed === true
          ? unmet.length
            ? `gate passed (advisory unmet: ${unmet.join(", ")})`
            : "gate passed"
          : `gate unmet (${unmet.join(", ") || "see project.json"})`;
    rows.push(`- ${def?.code ?? `P${String(id)}`} ${def?.title ?? "Phase"} — ${status} · ${gate}`);
  }
  return rows;
}

function commandBlock(kind: ProjectKind, project: Project): string[] {
  const base = [
    "# install + verify the emitted tree (Node >= 22)",
    "npm install",
    "npm run typecheck",
    ...(project.oracle.length
      ? [
          "# oracle spec = REAL assertions over the emitted modules (no todo stubs); green",
          "# means the scaffold modules are intact + every oracle seam is still honestly",
          "# stubbed — a seam test fails the moment that seam is implemented, which is",
          "# the cue to replace it with the row's real acceptance assertion",
          "npm test",
        ]
      : ["# no oracle rows yet — run the pipeline to P0/P1, then re-emit"]),
  ];
  if (kind === "webapp" || kind === "game") {
    base.push(
      "",
      "# dev server — index.html + src/main entry + vite config are emitted; the UI",
      "# itself is a contract-level shell per the P8 interface contract",
      "npm run dev",
    );
  }
  return base.map((l) => `  ${l}`);
}

function readmeBody(
  project: Project,
  kind: ProjectKind,
  specRows: [string, string][],
  treeRows: [string, string][] = [],
): string {
  const files: [string, string][] = [
    ["README.md", "this file — mission + commands"],
    ["DEPLOY.md", "run/test/env/deploy notes (honest local-only framing)"],
    [".env.example", "PLACEHOLDER env template — copy to .env, never commit real values"],
    ["package.json", "per-kind skeleton (scripts/deps) + tsconfig.json"],
    [".rapidtool/project.json", "the full exported project (packet, artifacts, oracle, contracts)"],
  ];
  if (kind === "webapp" || kind === "game") {
    files.push(
      ["index.html", "vite HTML entry — mounts src/main (fixes/135 bootability)"],
      ["vite.config.ts", "vite config (kind-appropriate plugins) — emitted for webapp"],
      ["src/main", "browser entry that mounts the UI shell (src/ui)"],
    );
  }
  files.push(...specRows);
  // fixes/144 (M2): generated-tree files the spec graph does not already table
  // (their paths are added under their node rows) get their own rows so the
  // README names every emitted file — never a stale "spec graph only" claim.
  for (const [treePath, origin] of treeRows) {
    if (!files.some(([p]) => p === treePath)) files.push([treePath, origin]);
  }
  if (kind === "game")
    files.push(["assets/manifest.json", "expected asset roster — NOT engine-generated"]);
  const kindNote = project.kind
    ? `kind ${kind} (mapped from declared kind "${project.kind}")`
    : `kind ${kind} (inferred from brief/domain — no declared kind yet)`;
  // fixes/144 (M2): the honest-boundary core line names whichever substance the
  // emit actually carries — the generated TREE (multi-file) or the legacy P6
  // module string. Never both, and never a claim about the absent one.
  const coreLine = treeRows.length
    ? "- The machine-verified substance is the generated tree under `src/` + `tests/` (project.generatedTree — fixes/144 M2): every file was emitted verbatim at its own repo-relative path and content-hashed at P6; `tests/oracle.spec.ts` imports the tree's ENTRY module (the file at the path the legacy P6 host would have used) so `npm test` executes the real tree. Scaffold infrastructure outside the tree is exactly that — infrastructure."
    : "- The machine-verified core is the generated P6 module under `src/` (project.generatedSource); everything else is a typed stub awaiting implementation.";
  const body = [
    `# ${mdLine(project.name, 120)}`,
    "",
    `> ${MACHINE_STAMP(project.id)}`,
    "",
    mdLine(project.brief || "_No brief recorded._", 500),
    "",
    "## Status",
    `- **Kind:** ${kind} — ${KIND_LABEL[kind]} (${kindNote})`,
    `- **Status:** ${project.status ?? "intake"} · **Current phase:** P${project.currentPhase ?? 0} · **Model route:** ${project.modelRoute ?? "unset"}`,
    project.createdAt ? `- **Created:** ${iso(project.createdAt)}` : null,
    "",
    "## What ships in this scaffold",
    "",
    "| File | Origin |",
    "| --- | --- |",
    ...files.map(([f, why]) => `| \`${f}\` | ${why} |`),
    "",
    "## Phase rail",
    "",
    ...phaseRailRows(project),
    "",
    "## Commands",
    "",
    "```text",
    ...commandBlock(kind, project),
    "```",
    "",
    "## Machine record",
    "",
    "- `.rapidtool/project.json` is the live exported project: packet, artifacts, oracle, contracts.",
    "- Regenerate this scaffold from it with the RapidTool emit command — hand-edits are overwritten.",
    "",
    "## Honest boundaries",
    "",
    coreLine,
    "- `src/ui/` is a contract-level shell (P8 interface contract), not a finished UI.",
    "- Deploy templates from P9/P12 are recorded artifacts only — see DEPLOY.md; nothing here deploys by itself.",
    "- `assets/` and `public/` are expected at the emitted scaffold and are NOT engine-generated.",
    "",
  ]
    .filter((l) => l !== null)
    .map((l) => l as string);
  return `${body.join("\n")}`;
}

// ---------------------------------------------------------------------------
// DEPLOY.md (E-27 ship notes — deplyNotes is the canonical export name)
// ---------------------------------------------------------------------------

/** Find a recorded engine artifact by kind + title predicate (stable titles). */
function findArtifact(
  project: Project,
  kind: string,
  title: RegExp,
): { id: string; title: string; body: string } | null {
  for (const a of project.artifacts) {
    if (a.kind === kind && title.test(a.title)) return a;
  }
  return null;
}

/** Recorded P9/P12 artifact blocks (verbatim under fences) + honesty caption. */
function recordedArtifacts(project: Project): string[] {
  const out: string[] = [];
  const push = (label: string, a: { title: string; body: string } | null): void => {
    if (!a) return;
    out.push(`### ${label} — ${mdLine(a.title, 120)}`, "");
    const f = fence(a.body);
    out.push(`${f}text`, a.body.trim(), f, "");
  };
  push("P9 CI template", findArtifact(project, "cicd", /GitHub Actions workflow/i));
  push("P9 IaC sketch", findArtifact(project, "cicd", /IaC sketch/i));
  push("P12 ADR", findArtifact(project, "docs", /Architecture Decision Records/i));
  push("P12 OpenAPI", findArtifact(project, "docs", /OpenAPI 3\.1/i));
  return out;
}

/**
 * DEPLOY.md content (E-27 ship-notes). Honest local-only framing: composed
 * from the P9/P12 artifacts recorded on the project plus per-kind defaults;
 * the pipeline never executed or validated those templates, credentials are
 * human-gated, and nothing in the scaffold deploys anywhere by itself.
 */
export function deplyNotes(project: Project): string {
  const kind = projectKindOf(project);
  const envNames = ENV_LINES[kind];
  const hasTemplates = project.artifacts.some(
    (a) => a.kind === "cicd" || (a.kind === "docs" && /OpenAPI|Decision/i.test(a.title)),
  );
  const kindDestinations: Record<ProjectKind, string> = {
    webapp:
      "static hosting with preview channels (e.g. Firebase hosting) is a common destination for this kind",
    game: "a static file host (e.g. itch.io or any static CDN) is a common destination for this kind",
    "cli-tool": "an npm registry publish is the common destination for this kind",
    library: "an npm registry publish is the common destination for this kind",
    service: "a container host (e.g. Cloud Run) is a common destination for this kind",
  };
  const devCommand =
    kind === "webapp" || kind === "game"
      ? [
          "```text",
          "  npm run dev   # vite dev server — index.html + src/main entry are emitted",
          "```",
        ]
      : ["  (no dev server: this kind has no UI entry yet — run `npm test` while implementing)"];
  const body = [
    `# DEPLOY.md — ${mdLine(project.name, 120)}`,
    "",
    `> ${MACHINE_STAMP(project.id)}`,
    `> ${DEPLOY_HONESTY_STAMP}`,
    "",
    "## What this is",
    "",
    `Local-first scaffold for “${mdLine(project.name, 120)}” (kind ${kind}, ${KIND_LABEL[kind]}), emitted from the RapidTool packet record. It is a starting point for the human/agent build work — not a shipped, hosted product.`,
    "",
    "## Run locally",
    "",
    "```text",
    "  npm install            # requires Node >= 22",
    "  cp .env.example .env   # then replace every PLACEHOLDER with a REAL local value",
    "  npm run typecheck",
    `  ${project.oracle.length ? "npm test" : "# no oracle rows yet — run the pipeline to P0/P1, then re-emit"}`,
    "```",
    ...(kind === "webapp" || kind === "game" ? ["", "  # dev server"] : []),
    ...devCommand,
    "",
    "Everything above runs on your local machine against the emitted tree. No service, database or account is required, configured or implied.",
    "",
    "## Environment",
    "",
    `The only env contract is \`.env.example\` (PLACEHOLDER values — never commit real secrets). Variables:`,
    "",
    "| Variable | Local meaning |",
    "| --- | --- |",
    ...envNames.map((name) => `| \`${name}\` | ${ENV_MEANING[name] ?? "see .env.example"} |`),
    "",
    "## Test",
    "",
    "```text",
    "  npm test",
    "```",
    "",
    "Oracle specs in `tests/oracle.spec.ts` are REAL assertions over the emitted modules (fixes/135) — no todo stubs. Every row keeps its pinned `orc-*` id; green means the scaffold modules are intact and every oracle seam is still honestly stubbed. A seam test fails the moment that seam is implemented — that is the cue to replace it with the row's real acceptance assertion.",
    "",
    "## Deploy — human-gated, nothing automatic",
    "",
    "No deployment is configured, wired or implied by this repository. Concretely:",
    "",
    "- The pipeline **recorded** CI/IaC/ADR/OpenAPI templates (P9/P12 artifacts, below and in `.rapidtool/project.json`); it never executed or validated them.",
    "- Deploying needs credentials and tooling **you** provision outside this repo; nothing here pushes to any cloud, registry or host.",
    `- For this kind, ${kindDestinations[kind]}. If you go that route: create the account/project yourself, then fill \`.env\` from \`.env.example\` — and verify credentials before any deploy.`,
    "- RapidTool's own P9 approval was a recorded, advisory gate — re-verify before a real deploy.",
    "",
    "## Assets",
    "",
    "`assets/` and `public/` are expected at the emitted scaffold and are NOT engine-generated" +
      (kind === "game"
        ? " — `assets/manifest.json` lists the placeholder roster to supply or render procedurally"
        : "") +
      ".",
    "",
    ...(hasTemplates
      ? [
          "## Recorded pipeline templates (P9/P12)",
          "",
          "Verbatim from the project artifacts — recorded, never executed:",
          "",
          ...recordedArtifacts(project),
        ]
      : [
          "## Recorded pipeline templates (P9/P12)",
          "",
          "_None yet — the project has not reached the P9/P12 phases that record CI/IaC/ADR/OpenAPI templates._",
        ]),
    "",
  ];
  return body.join("\n");
}

// ---------------------------------------------------------------------------
// scaffoldProject — assemble the deterministic file tree
// ---------------------------------------------------------------------------

/** Validate a Project enough to scaffold (defensive: callers may hand-build). */
function validProject(project: Project): { ok: true } | { ok: false; error: string } {
  if (project == null || typeof project !== "object")
    return { ok: false, error: "Expected a project object." };
  if (typeof project.name !== "string" || !project.name.trim()) {
    return { ok: false, error: "Cannot scaffold a project with an empty name." };
  }
  return { ok: true };
}

/**
 * Derive the full file tree for one project. Pure: returns {path, body} pairs
 * (the CLI writes them); deterministic: same project ⇒ same bytes. File order:
 * root docs → env/package → .rapidtool → boot files (webapp/game) → game
 * manifest → spec-graph modules in topo order (generatedSource hosted on the
 * first job node) → oracle spec.
 */
export function scaffoldProject(project: Project): ScaffoldResult {
  const check = validProject(project);
  if (!check.ok) return check;

  // Callers may hand-build sparse projects (validProject only demands a
  // name). Normalize the three collection fields the emitters iterate so a
  // missing array can never crash mid-emission; junk phase rows are further
  // guarded inside phaseRailRows.
  const proj: Project = {
    ...project,
    phases: Array.isArray(project.phases) ? project.phases : [],
    artifacts: Array.isArray(project.artifacts) ? project.artifacts : [],
    oracle: Array.isArray(project.oracle) ? project.oracle : [],
  };

  const kind = projectKindOf(project);
  const files: ScaffoldFile[] = [];
  const push = (path: string, body: string): void => {
    files.push({ path, body });
  };

  // --- Spec-graph nodes in topo order -----------------------------------------
  // Computed FIRST so every consumer (README table, module emission, oracle
  // spec surface ctx, boot entry) agrees on node order AND on the exact
  // sanitized path each node will be written to.
  const graph = project.specGraph;
  const nodes = (graph?.nodes ?? []).filter((n) => n && typeof n.file === "string");
  const order = (graph?.order ?? []).filter((id, i, all) => all.indexOf(id) === i);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const ordered: { node: (typeof nodes)[number]; index: number }[] = [];
  for (const id of order) {
    const node = byId.get(id);
    if (node) ordered.push({ node, index: ordered.length });
  }
  for (const n of nodes) {
    if (!ordered.some((o) => o.node.id === n.id)) ordered.push({ node: n, index: ordered.length });
  }
  // README rows must name the paths the emitter actually writes (safeNodePath
  // output), never raw node.file text: hostile/hand-built graphs would
  // otherwise list traversal-looking or space-containing paths that no file
  // corresponds to. Declaration order is kept for the table itself.
  const idxById = new Map(ordered.map((o) => [o.node.id, o.index]));
  const specRows: [string, string][] = nodes.map((node) => [
    node.id === "tests"
      ? "tests/oracle.spec.ts" // tests always materialize at the fixed oracle path
      : safeNodePath(node.file, node.id, idxById.get(node.id) ?? nodes.indexOf(node)),
    `${node.id} — ${prose(node.purpose)}`,
  ]);

  // Surface paths the oracle spec + boot entry import from (sanitized = the
  // paths actually pushed below). Undefined node ids ⇒ no module to import.
  const nodePath = (id: string): string | null => {
    const entry = ordered.find((o) => o.node.id === id);
    if (!entry) return null;
    return safeNodePath(entry.node.file, id, entry.index);
  };
  const uiPath = nodePath("ui");
  const storePath = nodePath("store");
  const apiPath = nodePath("api");

  // --- fixes/144 (M2): generatedTree assembly state -------------------------
  // Parse + validate the tree ONCE so every consumer (README rows, tree-file
  // pass, node bridges, oracle ctx) agrees on the accepted file set, its
  // sorted order, and the tree ENTRY module. The entry path keeps the legacy
  // host-selection contract: the first job node's file in topo order, else
  // src/generated.ts — when the tree ships no file at that path, the entry is
  // the tree's src/generated.ts file if present, else the first accepted file
  // in sorted order (always deterministic; treeMode ⇒ entryPath non-null).
  const rawTree = Array.isArray(project.generatedTree) ? project.generatedTree : [];
  const treeAccepted: { path: string; source: string; hash: string; attempt: number }[] = [];
  const treeRefusals: string[] = [];
  const seenTreePaths = new Set<string>();
  for (const row of rawTree) {
    if (row === null || typeof row !== "object") {
      treeRefusals.push("generatedTree:refused:<non-object>:row is not a file record");
      continue;
    }
    const pathRaw = (row as { path?: unknown }).path;
    const source = (row as { source?: unknown }).source;
    const hash = (row as { hash?: unknown }).hash;
    if (typeof source !== "string" || typeof hash !== "string") {
      treeRefusals.push(
        `generatedTree:refused:${typeof pathRaw === "string" ? JSON.stringify(pathRaw) : "<no-path>"}:path/source/hash must all be strings`,
      );
      continue;
    }
    const refusal = treePathRefusal(pathRaw);
    if (refusal !== null) {
      treeRefusals.push(`generatedTree:refused:${JSON.stringify(pathRaw)}:${refusal}`);
      continue;
    }
    const path = pathRaw as string;
    if (seenTreePaths.has(path)) {
      treeRefusals.push(`generatedTree:refused:${JSON.stringify(path)}:duplicate path — first row wins`);
      continue;
    }
    seenTreePaths.add(path);
    treeAccepted.push({
      path,
      source,
      hash,
      attempt: typeof (row as { attempt?: unknown }).attempt === "number"
        ? ((row as { attempt: number }).attempt as number)
        : 0,
    });
  }
  treeAccepted.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const treeMode = treeAccepted.length > 0;
  const treeByPath = new Set(treeAccepted.map((f) => f.path));
  const treeEntryPath: string | null = treeMode
    ? (() => {
        const jobEntry = ordered.find((o) => o.node.id.startsWith("job-"));
        const rolePath = jobEntry
          ? safeNodePath(jobEntry.node.file, jobEntry.node.id, jobEntry.index)
          : "src/generated.ts";
        const byPath = new Map(treeAccepted.map((f) => [f.path, f]));
        const entry = byPath.get(rolePath) ?? byPath.get("src/generated.ts") ?? treeAccepted[0];
        return entry ? entry.path : null;
      })()
    : null;
  // README table rows for tree files the spec graph does not already name.
  const treeDocRows: [string, string][] = treeMode
    ? treeAccepted
        .filter((f) => !specRows.some(([p]) => p === f.path))
        .map(
          (f): [string, string] => [
            f.path,
            "generated tree file — brief capability module (project.generatedTree, fixes/144 M2)",
          ],
        )
    : [];

  // --- Root documents + skeleton files -------------------------------------
  push("README.md", readmeBody(proj, kind, specRows, treeDocRows));
  push("DEPLOY.md", deplyNotes(proj));
  push(".env.example", envExample(kind));
  push("package.json", packageJson(kind, proj, proj.oracle.length > 0));
  push("tsconfig.json", tsconfigJson(kind, proj.oracle.length > 0));
  push(".rapidtool/project.json", exportProjectJson(project));

  // --- Browser boot files (fixes/135): kinds whose package.json declares
  // vite dev/build scripts get an index.html + entry (+ vite.config for
  // webapp) so `npm run dev`/`npm run build` actually run in the emitted dir.
  if (kind === "webapp" || kind === "game") {
    const entryFile = kind === "webapp" ? "src/main.tsx" : "src/main.ts";
    push("index.html", emitIndexHtml(proj, `/${entryFile}`));
    if (kind === "webapp") push("vite.config.ts", emitViteConfig());
    push(entryFile, emitMainEntry(kind, proj, uiPath ? relSpecifier("src", uiPath) : null));
  }

  if (kind === "game") {
    push("assets/manifest.json", emitGameManifest(proj));
  }

  // --- Generated tree files (fixes/144 M2) ----------------------------------
  // TREE MODE ONLY: every accepted tree file is emitted VERBATIM at its own
  // repo-relative path (never wrapped in scaffold headers — bodies must stay
  // byte-identical to the synthesized source), in sorted path order. A file
  // whose path a spec-graph node also claims is emitted HERE once; the node
  // loop below skips every tree-covered path.
  if (treeMode) {
    for (const tf of treeAccepted) push(tf.path, tf.source);
  }

  // --- Spec-graph modules in topo order (nodes/ordered computed above) -------

  const jobLabelOf = (node: { purpose: string }): string | null => {
    const m = node.purpose.match(/["“]([^"”]+)["”]/);
    return m ? collapse(m[1]) : null;
  };

  const generated = (project.generatedSource ?? "").trim();
  let hosted = false;
  let hostPath: string | null = null;
  for (const { node, index } of ordered) {
    // The "tests" node materializes as tests/oracle.spec.ts below (single
    // emission); it is not a src module.
    if (node.id === "tests") continue;
    const path = safeNodePath(node.file, node.id, index);
    const isJob = node.id.startsWith("job-");
    let body: string;
    if (treeMode) {
      // fixes/144 (M2): a path a tree file owns was emitted by the tree pass
      // above — never double-push. src/ui keeps its honest contract-level
      // shell (the webapp/game UI is never machine-generated — g6 delta);
      // every other uncovered graph node becomes a thin re-export of the tree
      // ENTRY module so the promised module surface still materializes and
      // resolves to real generated code (never a TODO stub beside it).
      if (treeByPath.has(path)) continue;
      body =
        node.id === "ui"
          ? emitUi(node, proj, kind)
          : emitTreeBridge(
              { file: path, purpose: node.purpose, id: node.id },
              proj,
              treeEntryPath as string,
            );
      push(path, body);
      continue;
    }
    if (node.id === "schema") {
      body = emitSchema(node, proj);
    } else if (node.id === "api") {
      body = emitApi(node, proj);
    } else if (node.id === "store") {
      body = emitStore(node, proj);
    } else if (isJob) {
      if (generated && !hosted) {
        body = emitGeneratedHost(node, proj, generated);
        hosted = true;
        hostPath = path;
      } else {
        body = emitJobStub(node, proj, jobLabelOf(node));
      }
    } else if (node.id === "ui") {
      body = emitUi(node, proj, kind);
    } else {
      body = emitJobStub(node, proj, jobLabelOf(node));
    }
    push(path, body);
  }
  if (!treeMode && generated && !hosted) {
    // Generated module exists but the graph has no job node to host it.
    hostPath = "src/generated.ts";
    push(
      hostPath,
      emitGeneratedHost(
        {
          file: hostPath,
          purpose: "P6 synthesis module (generatedSource)",
          id: "generated",
        },
        proj,
        generated,
      ),
    );
  }

  // --- Oracle acceptance spec ------------------------------------------------
  // Real assertions over the emitted module surfaces (fixes/135) — the ctx
  // names the sanitized modules the spec may import (store/api) and the path
  // hosting generatedSource (template modules gain an export surface). TREE
  // mode names the tree ENTRY module instead: the spec imports only the tree
  // (store/api/template surfaces are generated content with unknown exports).
  if (proj.oracle.length > 0 || ordered.some((o) => o.node.id === "tests")) {
    push(
      "tests/oracle.spec.ts",
      treeMode
        ? emitOracleSpec(proj, {
            treeEntryPath,
            treePaths: treeAccepted.map((f) => f.path),
          })
        : emitOracleSpec(proj, { storePath, apiPath, hostPath }),
    );
  }

  const summary = treeMode
    ? `${files.length} files · kind ${kind} · packet ${project.id || "unknown"} — tree files already on disk · generatedTree: ${treeAccepted.length} file${treeAccepted.length === 1 ? "" : "s"} assembled${treeRefusals.length ? `, ${treeRefusals.length} refused (see warnings)` : ""}`
    : `${files.length} files · kind ${kind} · packet ${project.id || "unknown"} — write them to disk with the emit command`;
  return {
    ok: true,
    files,
    summary,
    ...(treeRefusals.length ? { warnings: treeRefusals } : {}),
  };
}
