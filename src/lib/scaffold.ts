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
// fixes/216b (106 T-08 / F-05): no emitted assertion may be unable to fail.
// An A7 row the emitted modules give no surface to assert against is emitted
// as a visibly-marked test.skip("<id> — NOT IMPLEMENTED") — never the old
// always-true `"<id>".length > 0` pair — and the README counts those rows
// separately from the rows that carry a real assertion.
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
// fixes/196: leftover job-* nodes after the first hosted generatedSource
// module re-export that host (emitTreeBridge) — never a TODO(E-15) throw stub
// and never invented job bodies. No generatedSource ⇒ leftover jobs stay
// emitJobStub (byte-identical keyless floor). Tree-covered paths still skip.
//
// fixes/247 (G5 · 216y §2.3): the emitted failure paths carry the harness's
// coded-refusal contract across the artifact boundary — every TODO(E-15) stub
// rejection and every entry boot guard prefixes a REGISTERED RT_E code
// (EMITTED_REFUSAL_CODE below; errors.ts is the code source — never an
// invented id) in the `<code> · <reason>` refusal-log shape, and the emitted
// oracle spec asserts the coded form. A consumer of the tree can classify
// failures instead of receiving text-only errors.
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
//   export function scaffoldProject(project: Project, options?: ScaffoldOptions): ScaffoldResult
//   export function deployNotes(project: Project): string  (DEPLOY.md content;
//     the legacy misspelling `deplyNotes` stays as a back-compat alias)
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

/**
 * fixes/277 (A3-f07 / W-14 · W-27-C W-28b): the emitted-UI generation seam.
 * Today the webapp shell's UI is a name-dump (`generated exports (N): names`
 * — A3-f07) and machine UI generation does not exist; this hook is the stage's
 * home. A caller MAY supply a `uiGeneration` hook (via `ScaffoldOptions`); it
 * receives the emit context and returns replacement source lines for the
 * emitted shell's generated-substance body, or `null` to keep the default.
 * The DEFAULT hook (`defaultUiGeneration` below) is the current name-dump —
 * a no-op that reproduces the pre-277 bytes exactly.
 */
export type UiGenerationRequest = {
  project: Project;
  kind: ProjectKind;
  /** The imported namespace of the generated entry module in the emitted
   *  shell (`"generated"`), or null when the emit wrote no generated
   *  substance at all (the shell then renders the honest no-module notice). */
  generatedNamespace: string | null;
};

export type UiGenerationHook = (request: UiGenerationRequest) => string[] | null;

/** Optional inputs to `scaffoldProject` (additive; omitted ⇒ pre-277 bytes). */
export type ScaffoldOptions = {
  /** A3-f07: the emitted-UI generation hook (default = the name-dump). */
  uiGeneration?: UiGenerationHook;
};

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
      /**
       * fixes/277 (R3-f03 / W-06): machine-readable trail verdicts on the emit
       * envelope (see `trailVerdictOf`) — present only when true, so clean
       * emissions stay byte-identical for every existing consumer.
       *
       * `redTree` — the project's own trail's last tree verdict is an uncleared
       * `p6.tree.failure`: this artifact is a RECORD of a failed tree-run, not
       * a verified build (the same condition headless's red-tree emit guard
       * refuses/banners on; this field makes it readable WITHOUT the guard).
       * `partial` — the last synthesis verdict is a phase-6
       * `p6.synthesis.refused` while real generated substance exists (prior
       * chunks kept — `partialTreeRefuse`): the emission is a PARTIAL tree,
       * neither the floor nor a full pass. The oracle spec's `capability.N`
       * rows skip-with-reason on a partial emission instead of reddening.
       */
      redTree?: true;
      partial?: true;
      /**
       * fixes/277 (A3-f07): which UI-generation path produced the emitted
       * webapp shell — the default name-dump, or a caller-supplied hook whose
       * lines were applied. Absent when the emission carried no webapp UI node
       * (no name-dump was generated, so there is nothing to report).
       */
      uiGeneration?: {
        hook: "default-name-dump" | "caller";
        /** true when a caller hook's lines replaced the name-dump this emit. */
        applied: boolean;
        /** The emitted ui module path the hook's lines landed in. */
        uiPath: string;
      };
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

/**
 * fixes/247 (G5 · 216y §2.3 — "the coded-refusal contract stops at the
 * artifact boundary"): every emitted failure path names a REGISTERED code
 * from errors.ts (invariant I13), never an invented one. `RT_E_VALIDATION`
 * is the registry's class for an operation a seam declines with a named
 * reason — the same class phases.ts:119 and headless.ts's policy seam stamp
 * on their guard refusals ("a validation refusal, not an opaque internal
 * error"). The emitted message shape is the refusal-log shape
 * `<RT_E code> · <reason>` (engine.ts refusalClassOf parses it).
 */
const EMITTED_REFUSAL_CODE = "RT_E_VALIDATION";

/** `<RT_E code> · <reason>` — the prefix every emitted failure path carries. */
const emittedRefusal = (reason: string): string => `${EMITTED_REFUSAL_CODE} · ${reason}`;

/**
 * 330 Transit (emitted-artifact integrity): CommonJS residue that CANNOT load
 * inside the `"type":"module"` package this emitter declares — `module.exports`
 * anywhere, or a bare `exports.`/`exports =` assignment head (never
 * `xexports.`/`reexports.` look-alikes). Same shape as headless.ts's
 * `CJS_RESIDUE_RE` (the emit-time materializer's guard), mirrored here because
 * the materializer only rewrites project.generatedTree rows — a lone
 * generatedSource (no tree) and any direct scaffold caller bypass it, and a
 * CJS body embedded verbatim throws `ReferenceError: module is not defined in
 * ES module scope` at import, so the emitted product would be unloadable.
 */
const CJS_MODULE_RESIDUE_RE = /module\.exports|(?:^|[^\w$.])exports\s*(?:\.|=[^=])/;

/** Emitted code extensions whose bodies must be ESM (the declared package). */
const EMITTED_CODE_EXT_RE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/i;

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

/**
 * Exact repo-relative paths a generatedTree file may be assembled at even
 * though they sit outside every TREE_ALLOWED_ROOTS prefix.
 *
 * fixes/216d (106 T-04 / F-03): the engine's own tree ENTRY barrel is written
 * at `src/generated.ts` (codegen.server.ts `TREE_ENTRY_PATH`) — a path that
 * starts with NO allowed root ("src/generated/" needs the trailing slash), so
 * the allow-list refused the declared entry BY CONSTRUCTION: the barrel was
 * dropped and the entry silently degraded to the alphabetically-first tree
 * file. Exact match (never a prefix) so the widening cannot admit look-alikes
 * such as `src/generated.ts.bak`.
 */
const TREE_ALLOWED_FILES = new Set(["src/generated.ts"]);

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
  if (
    !TREE_ALLOWED_ROOTS.some((root) => p.startsWith(root)) &&
    !TREE_ALLOWED_FILES.has(p)
  )
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

/** Directory part of an emitted (sanitized) repo-relative path ("." at root). */
function dirOf(path: string): string {
  const slash = String(path ?? "").lastIndexOf("/");
  return slash > 0 ? String(path).slice(0, slash) : ".";
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

/**
 * fixes/217f (T4.2, 216x §2.3 item 1): the emitted tree's `.gitignore`. Once a
 * real install + build runs INSIDE an emitted tree (T4.1), `node_modules/` and
 * `dist/` land in the artifact and the tree stops being a reviewable unit —
 * this file is what keeps that diff clean. It ignores ONLY what an install /
 * build / verify run leaves behind and keeps the reviewed artifacts tracked:
 * the generated source, `.rapidtool/project.json`, the notes and the report
 * files. Byte-stable: no timestamps, no absolute paths, identical for every
 * kind and mode (the determinism suite pins it).
 */
function gitignoreFile(): string {
  return [
    "# RapidTool scaffold .gitignore — keeps this emitted tree a reviewable unit.",
    "# Ignore only what a real install/build/verify run leaves behind (T4.1/T4.2);",
    "# the generated source, .rapidtool/project.json and the notes stay tracked.",
    "node_modules/",
    "dist/",
    ".rapidtool/logs/",
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
    // fixes/277 (R3-f06): the service kind's runnable entry — `npm start`
    // executes src/main.ts (readiness = the entry's structured stub, which
    // reads PORT and refuses honestly until the service body is implemented).
    start: "node --experimental-strip-types src/main.ts",
  },
};

function packageJson(kind: ProjectKind, project: Project, hasTests: boolean): string {
  const scripts = { ...(PKG_SCRIPTS[kind] ?? {}) };
  if (!hasTests) delete scripts.test;
  const slug = slugName(project.name);
  const pkg: Record<string, unknown> = {
    name: slug,
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
  // fixes/277 (R3-f06 / W-15): per-kind entry wiring — a real consumer
  // (a bundler for the game, `npm exec` for a CLI, an import for a library,
  // `npm start` for a service) needs the entry DECLARED, not just emitted.
  // Every value names only a file this emitter actually writes
  // (emitMainEntry / emitKindEntry / emitBinLauncher), never an undeclared
  // path; webapp is unchanged (its entry is declared by index.html).
  if (kind === "game") {
    // the browser entry the emitted index.html script tag loads.
    pkg.main = "src/main.ts";
  } else if (kind === "cli-tool") {
    // the runnable launcher emitBinLauncher writes; it delegates to
    // src/main.ts (emitKindEntry) with argv passed straight through.
    pkg.bin = { [slug]: `bin/${slug}.mjs` };
  } else if (kind === "library") {
    // the entry emitKindEntry writes, as the package's public module.
    pkg.main = "./src/main.ts";
    pkg.exports = { ".": "./src/main.ts" };
    pkg.files = ["src"];
  } else if (kind === "service") {
    // the entry `npm start` runs (PKG_SCRIPTS.service.start).
    pkg.main = "./src/main.ts";
  }
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

/**
 * api node: the recorded A6 contract endpoints + the router over them.
 *
 * fixes/328 P2 (TA-15 / P0-04): the recorded endpoint table is complete
 * (method+path+job), so `route` dispatches for real — a recorded endpoint
 * whose job module was emitted (see `emitJobModule`) is served by that module;
 * an endpoint with no emitted implementation still refuses with the coded
 * `RT_E_VALIDATION · TODO(E-15) stub` form (honest: the seam is absent, and
 * nothing pretends otherwise). `opts.jobModules` names the REAL job modules
 * this emit wrote (label + sanitized path); empty ⇒ the pre-328 bytes'
 * behaviour (every recorded endpoint refuses).
 */
function emitApi(
  node: { file: string; purpose: string },
  project: Project,
  opts: { apiPath?: string; jobModules?: readonly { label: string; path: string }[] } = {},
): string {
  const endpoints = project.contracts?.endpoints ?? [];
  const jobModules = Array.isArray(opts.jobModules) ? opts.jobModules : [];
  const apiPath = typeof opts.apiPath === "string" && opts.apiPath ? opts.apiPath : node.file;
  const lines = [
    ...sourceHeader(node.file, node.purpose, project, [
      "// HTTP contracts bound to jobs (A6). The router below dispatches every",
      "// recorded endpoint to its job module; an endpoint whose job has no",
      "// emitted implementation still refuses with the coded RT_E_VALIDATION",
      "// form — never a silent success. tests/oracle.spec.ts names the oracle",
      "// expectations.",
    ]),
    ...jobModules.map(
      (m, i) => `import * as jobMod${i} from ${jstr(tsImportPath(dirOf(apiPath), m.path))};`,
    ),
    ...(jobModules.length ? [""] : []),
    `export type EndpointMethod = "GET" | "POST" | "PATCH";`,
    `export type Endpoint = { method: EndpointMethod; path: string; job: string };`,
    "",
    `export const ENDPOINTS: Endpoint[] = [`,
    ...(endpoints.length
      ? endpoints.map(
          (e) => `  { method: ${jstr(e.method)}, path: ${jstr(e.path)}, job: ${jstr(e.job)} },`,
        )
      : [`  // No endpoints recorded — complete P0/P1 (A6 synthesizer).`]),
    `];`,
    "",
    "/** Recorded endpoints → the REAL job modules this emit materialised. */",
    "const HANDLERS: Record<string, (input: unknown) => Promise<unknown>> = {",
    ...jobModules.map((m, i) => `  ${jstr(m.label)}: (input: unknown) => jobMod${i}.handle(input),`),
    "};",
    "",
    `export async function route(`,
    `  method: EndpointMethod,`,
    `  path: string,`,
    `  input: unknown,`,
    `): Promise<{ ok: boolean; job?: string; result?: unknown }> {`,
    `  const endpoint = ENDPOINTS.find((e) => e.method === method && e.path === path);`,
    `  if (!endpoint) {`,
    `    throw new Error(\`${EMITTED_REFUSAL_CODE} · unknown endpoint \${method} \${path} — not in the recorded A6 contract\`);`,
    `  }`,
    `  const handler = HANDLERS[endpoint.job];`,
    `  if (!handler) {`,
    `    throw new Error(\`${emittedRefusal("TODO(E-15) stub: implement")} \${method} \${path}\`);`,
    `  }`,
    `  return { ok: true, job: endpoint.job, result: await handler(input) };`,
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
    `  throw new Error(${jstr(emittedRefusal(`TODO(E-15) stub: implement job ${label}`))});`,
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

// ---------------------------------------------------------------------------
// fixes/328 P2 (TA-15 / P0-04) — REAL per-job modules from the recorded API
// surface.
//
// The keyless floor keeps the honest coded refusal (`emitJobStub`): with no
// specRecord there is no recorded surface to implement, and inventing one is
// forbidden. When the project carries the brief-faithful specRecord
// (`implementationSpec.typeSignatures`), each spec-graph job node whose label
// names one or more of those signatures gets a REAL module instead of a throw
// placeholder or a re-export bridge: the recorded signature is emitted with
// its own name, parameters and return type over a deterministic in-module
// record store, so the file is executable code carrying the job's declared
// export surface — never one module wearing N filenames.
//
// Honesty boundary: the recorded spec carries the API SURFACE (names, params,
// return types) plus the job's A6 endpoints and A7 row ids — it does NOT carry
// domain rules or field shapes for the referenced contract types. The body
// implements exactly the recorded call (a keyed store transition) and every
// referenced-but-unshaped contract type is declared OPAQUELY. Nothing is
// invented. The signature→job binding mirrors codegen's
// `bindSignaturesToJobTargets` (same rule: first job node, graph order, whose
// label the function name contains, labels shorter than 3 chars never match);
// it is mirrored rather than imported because codegen.server.ts is a
// server-only module and scaffold.ts is in the console/client graph.
// ---------------------------------------------------------------------------

/** One parsed parameter of a recorded typeSignature. */
type ParsedSignatureParam = { name: string; type: string; optional: boolean; rest: boolean };

/** One parsed recorded typeSignature (name/params/return, re-emittable verbatim). */
type ParsedSignature = {
  name: string;
  text: string;
  params: ParsedSignatureParam[];
  /** Full recorded return type text ("Promise<X>", "X", "void"; "" when absent). */
  returns: string;
  /** Inner type of the recorded `Promise<X>` return, else "". */
  returnInner: string;
  /** The (inner) return is an array type ⇒ the emitted body wraps in `[...]`. */
  array: boolean;
  /** The recorded return was `Promise<…>` ⇒ the emitted function is async. */
  isAsync: boolean;
};

/** TS builtins that must never be re-declared as opaque contract aliases. */
const TS_BUILTIN_TYPES = new Set([
  "string", "number", "boolean", "unknown", "any", "void", "never", "object", "symbol",
  "bigint", "null", "undefined", "Date", "Promise", "Partial", "Record", "Array",
  "ReadonlyArray", "Readonly", "Map", "Set", "JSON", "Error", "true", "false",
]);

/** Emitted job-module locals/generics that an alias must never shadow. */
const JOB_MODULE_RESERVED = new Set([
  "JOB", "ENDPOINTS", "JobEndpoint", "ORACLE_ROWS", "records", "sequence", "store", "handle",
]);

/** Split `text` on top-level `sep` characters (nesting- and quote-aware). */
function splitTopLevel(text: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = "";
  let current = "";
  for (const ch of text) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === "<" || ch === "(" || ch === "[" || ch === "{") depth += 1;
    else if (ch === ">" || ch === ")" || ch === "]" || ch === "}") depth -= 1;
    if (ch === sep && depth <= 0) {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out;
}

/**
 * Parse one recorded typeSignature into the pieces the emitter re-emits.
 * Returns null for anything that cannot be re-emitted verbatim (an honest
 * skip: an unparseable signature is never guessed into a function).
 */
function parseTypeSignature(raw: string): ParsedSignature | null {
  const text = String(raw ?? "").trim().replace(/;$/, "").trim();
  if (!text) return null;
  const m =
    /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\s+)?([A-Za-z_$][A-Za-z0-9_$]*)\s*\(([\s\S]*)\)\s*(?::\s*([\s\S]+))?$/.exec(
      text,
    );
  if (!m) return null;
  const params: ParsedSignatureParam[] = [];
  for (const part of splitTopLevel(m[2], ",")) {
    const p = part.trim();
    if (!p) continue;
    const pm = /^(\.\.\.)?([A-Za-z_$][A-Za-z0-9_$]*)(\?)?\s*:\s*([\s\S]+)$/.exec(p);
    if (!pm) return null;
    params.push({ rest: pm[1] === "...", name: pm[2], optional: pm[3] === "?", type: pm[4].trim() });
  }
  const returns = (m[3] ?? "").trim();
  const promise = /^Promise\s*<([\s\S]+)>$/.exec(returns);
  const returnInner = promise ? promise[1].trim() : "";
  const shape = returnInner || returns;
  return {
    name: m[1],
    text,
    params,
    returns,
    returnInner,
    array: /\[\]\s*$/.test(shape) || /^(?:Readonly)?Array\s*</.test(shape),
    isAsync: promise !== null,
  };
}

/** Contract type NAMES referenced by the parsed signatures (declared opaquely,
 *  never invented as field shapes — the spec records the name only). */
function opaqueTypeNames(signatures: readonly ParsedSignature[]): string[] {
  const out: string[] = [];
  const add = (text: string): void => {
    for (const id of String(text ?? "").match(/[A-Za-z_$][A-Za-z0-9_$]*/g) ?? []) {
      if (TS_BUILTIN_TYPES.has(id) || JOB_MODULE_RESERVED.has(id) || out.includes(id)) continue;
      out.push(id);
    }
  };
  for (const s of signatures) {
    for (const p of s.params) add(p.type);
    add(s.returnInner || s.returns);
  }
  return out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * A REAL job module (fixes/328 P2): the job's recorded typeSignatures emitted
 * with their own names/params/return types over a deterministic in-module
 * record store, plus the job's recorded A6 endpoints / A7 row ids and the
 * uniform `handle` entry the emitted router dispatches to.
 */
function emitJobModule(
  node: { file: string; purpose: string; id: string },
  project: Project,
  label: string,
  signatures: readonly ParsedSignature[],
  endpoints: readonly { method: string; path: string }[],
  oracleIds: readonly string[],
): string {
  const lines: string[] = [
    ...sourceHeader(node.file, node.purpose, project, [
      "// REAL module (fixes/328 P2 / TA-15): implements this job's recorded",
      "// typeSignatures (the brief-faithful specRecord) over a deterministic",
      "// in-module record store. The recorded spec carries the API surface —",
      "// function names, parameters, return types — plus the A6 endpoints and",
      "// A7 row ids below; it carries no domain rules, so nothing beyond the",
      "// recorded surface is claimed here. Never a re-export, never a stub.",
    ]),
    `export const JOB = ${jstr(label)};`,
    "",
    `export type JobEndpoint = { method: "GET" | "POST" | "PATCH"; path: string };`,
    `export const ENDPOINTS: JobEndpoint[] = [`,
    ...endpoints.map((e) => `  { method: ${jstr(e.method)}, path: ${jstr(e.path)} },`),
    `];`,
    "",
    `/** A7 oracle row ids recorded for this job — the acceptance prose is emitted`,
    ` *  into tests/oracle.spec.ts. */`,
    `export const ORACLE_ROWS: readonly string[] = [${oracleIds.map((id) => jstr(id)).join(", ")}];`,
    "",
  ];

  const aliases = opaqueTypeNames(signatures);
  if (aliases.length > 0) {
    lines.push(
      "/** Contract types named by the recorded typeSignatures. The spec records",
      " *  the NAME only, never a field shape — declared opaquely rather than",
      " *  invented. Replace each with the real interface when the contract",
      " *  carries one. */",
      ...aliases.map((name) => `export type ${name} = string | number | Record<string, unknown>;`),
      "",
    );
  }

  lines.push(
    "/** Deterministic record store: each call keys on the first string argument",
    " *  (a declared id parameter) or a monotonic slot, merges object arguments,",
    " *  and stamps the operation name. Pure in-module state; no I/O, no clock",
    " *  beyond the recorded call itself. */",
    "const records = new Map<string, Record<string, unknown>>();",
    "let sequence = 0;",
    "function store(operation: string, args: readonly unknown[]): Record<string, unknown> {",
    "  const idArg = args.find((a): a is string => typeof a === \"string\" && a.length > 0);",
    "  const key = idArg ?? operation + \"#\" + String((sequence += 1));",
    "  const merged: Record<string, unknown> = { ...(records.get(key) ?? { id: key }), op: operation };",
    "  args.forEach((arg, index) => {",
    "    if (arg !== null && typeof arg === \"object\" && !Array.isArray(arg)) {",
    "      Object.assign(merged, arg as Record<string, unknown>);",
    "    } else if (arg !== undefined) {",
    "      merged[\"arg\" + String(index)] = arg;",
    "    }",
    "  });",
    "  records.set(key, merged);",
    "  return merged;",
    "}",
    "",
  );

  for (const sig of signatures) {
    const paramList = sig.params
      .map((p) => `${p.rest ? "..." : ""}${p.name}${p.optional ? "?" : ""}: ${p.type}`)
      .join(", ");
    const argList = sig.params.map((p) => p.name).join(", ");
    const retType = sig.returns || "void";
    const call = `store(${jstr(sig.name)}, [${argList}])`;
    const body = sig.array
      ? `  return [${call}];`
      : retType === "void"
        ? `  ${call};`
        : `  return ${call};`;
    lines.push(
      `/** Recorded signature: ${prose(sig.text)} */`,
      `export ${sig.isAsync ? "async " : ""}function ${sig.name}(${paramList}): ${retType} {`,
      body,
      `}`,
      "",
    );
  }

  lines.push(
    "/** Uniform entry the emitted HTTP router dispatches to for this job's A6",
    " *  endpoints (see src/api/routes.ts). */",
    "export async function handle(input: unknown): Promise<Record<string, unknown>> {",
    "  return store(JOB, [input]);",
    "}",
    "",
  );
  return lines.join("\n");
}

/**
 * fixes/277 (A3-f07 / W-14): the DEFAULT emitted-UI generation — the current
 * name-dump, byte-identical to the pre-277 shell. TODO(A3-f07): machine UI
 * generation does not exist (the webapp UI is deliberately never
 * machine-generated); when it lands it replaces THIS body behind the same
 * UiGenerationHook contract and must clear the ≥2-domain-field / interaction
 * bar (W-14) before any claim moves. Today a caller-supplied hook may return
 * replacement body lines; null ⇒ this default is used.
 */
const defaultUiGeneration = ({
  project,
  generatedNamespace,
}: UiGenerationRequest): string[] => {
  if (generatedNamespace === null) {
    return [
      `  const [notice] = useState<string>(`,
      `    "shell — no generated module yet; run P6 then re-emit",`,
      `  );`,
      `  return (`,
      `    <main>`,
      `      <h1>{${jstr(prose(project.name))}}</h1>`,
      `      <p>{notice}</p>`,
      `    </main>`,
      `  );`,
    ];
  }
  // TODO(A3-f07) at this line: the name-dump is the stage's current output — a
  // real generator (interactions, ≥2 domain fields per W-14) replaces it here.
  return [
    `  const exported = Object.keys(generated);`,
    `  return (`,
    `    <main>`,
    `      <h1>{${jstr(prose(project.name))}}</h1>`,
    `      <p>generated exports ({exported.length}): {exported.join(", ") || "(none)"}</p>`,
    `    </main>`,
    `  );`,
  ];
};

/**
 * ui node: kind-appropriate shell (webapp → React; game → canvas; else CLI-ish TS).
 *
 * fixes/216d (106 T-05 / F-03): a shell that surfaces generated exports imports
 * the module the emitter ACTUALLY writes as the generated entry — `genEntry.path`
 * (the tree ENTRY in tree mode, else the hosted P6 module), resolved relative to
 * the emitted UI file (`genEntry.from`) — never the literal "../generated.ts",
 * which the path allow-list refuses and nothing ever wrote (a guaranteed
 * dangling specifier in every tree-mode webapp). `genEntry === null` ⇒ no
 * generated substance at all ⇒ no generated import in the shell.
 *
 * fixes/277 (A3-f07): the webapp branch's generated-substance body is produced
 * by the `uiGeneration` hook (the single call point) — default = the
 * name-dump, byte-identical to the pre-277 shell.
 */
function emitUi(
  node: { file: string; purpose: string },
  project: Project,
  kind: ProjectKind,
  genEntry: { from: string; path: string } | null,
  uiGeneration: UiGenerationHook,
): string {
  if (kind === "webapp") {
    const genImport = genEntry
      ? [`import * as generated from ${jstr(tsImportPath(dirOf(genEntry.from), genEntry.path))};`, ""]
      : [];
    // fixes/277 (A3-f07): THE single uiGeneration call point. The hook
    // (caller-supplied via ScaffoldOptions, or the default name-dump above)
    // returns the shell's generated-substance body lines ONLY — the
    // surrounding imports/export wrapper stay scaffold-owned so a hook can
    // never break the emitted module's shape.
    // fixes/277 (A3-f07): the hook contract — a `null` return keeps the
    // default name-dump (which is total: it never returns null), so the
    // spread below always receives string[] (R3-f03 break fix: the hook's
    // declared `string[] | null` return must be coalesced, never spread raw).
    const uiRequest: UiGenerationRequest = {
      project,
      kind,
      generatedNamespace: genEntry ? "generated" : null,
    };
    const genBody = uiGeneration(uiRequest) ?? defaultUiGeneration(uiRequest);
    return [
      ...sourceHeader(node.file, node.purpose, project, [
        "// Operator surfaces bound to generated modules (P8). Not a stub wall:",
        "// the generated entry module (the file this emitter wrote) is imported",
        "// when P6 produced one — never a path nothing writes.",
      ]),
      ...(genEntry ? [] : [`import { useState } from "react";`]),
      ...genImport,
      `export function Console() {`,
      ...genBody,
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
          `  throw new Error(${jstr(emittedRefusal("TODO(E-15) stub: implement the service entry"))});`,
          `}`,
          "",
        ]
      : [
          `export type CliContext = { argv: string[]; env: Record<string, string> };`,
          "",
          `export async function main(ctx: CliContext): Promise<number> {`,
          `  void ctx;`,
          `  throw new Error(${jstr(emittedRefusal("TODO(E-15) stub: implement the console entry per the oracle"))});`,
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
  /** fixes/216k D2: tree-covered job modules (label + .ts path) whose real
   *  export surface the job-keyed oracle rows assert. Absent/empty ⇒ the spec
   *  is byte-identical to pre-216k output. */
  treeJobModules?: { label: string; path: string }[];
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
  /**
   * leftover job-* labels whose nodes re-export the hosted generatedSource
   * module (fixes/196). Oracle rows for these jobs must NOT assert the
   * TODO(E-15) throw — they are bridges, not stubs. Stub leftover jobs
   * (no generatedSource) are omitted here and MAY still assert throw.
   */
  bridgedJobLabels?: Iterable<string>;
  /** fixes/328 P2: job labels whose REAL module this emit materialised — the
   *  router dispatches their endpoints to it (rows assert the dispatch). */
  wiredJobLabels?: Iterable<string>;
  /** fixes/328 P2: the real job modules themselves (label + .ts path), for the
   *  rows that assert a materialised module directly (no api surface, e.g.
   *  tree mode where api is a bridge). */
  wiredJobModules?: { label: string; path: string }[];
  /**
   * fixes/216b (106 T-08 / F-05): the row-classification surface, built ONCE
   * per scaffold so the emitted rows and the README census cannot disagree
   * about which rows carry a real assertion. scaffoldProject passes the same
   * object it counts; when absent, emitOracleSpec derives it from the paths
   * above (byte-identical — the same rules, one place).
   */
  rowSurface?: OracleRowSurface;
  /**
   * fixes/277 (R3-f03 / W-06): the emission carries a PARTIAL synthesis tree
   * (prior chunks' real files kept after a refused chunk — `partialTreeRefuse`,
   * detected by `trailVerdictOf`). When true, each `capability.N` row is
   * emitted with a skip-with-reason path: a capability whose demanded
   * identifier forms appear in NO scanned file names a module that was never
   * materialised and SKIPS with that reason instead of asserting a red — the
   * pre-fix 28-red cascade on a 1-file partial tree read as product failure.
   * Absent/false ⇒ the capability rows are byte-identical to the pre-277
   * output. TODO(R3-f03): the full capability→node mapping (name WHICH declared
   * module is missing) once the spec graph carries it.
   */
  partial?: boolean;
};

// ---------------------------------------------------------------------------
// fixes/216b (106 T-08 / F-05) — no emitted assertion may be unable to fail.
//
// The scaffold emits one test per A7 oracle row. Rows the emitted modules give
// a surface to assert against carry a REAL assertion (the seam rejection / the
// template's phase bookkeeping / the endpoint contract). Rows they do not were
// previously emitted as an always-true pair —
//   assert.ok("<id>".length > 0, "row id is pinned");
//   assert.ok("<prose>".length >= 0, "row prose recorded");
// which cannot fail under any change to any file, so `npm test` printed the six
// rows that matter as green while the product's contract had zero coverage.
// The verdict for those rows is now "not-implemented": a visibly-marked
// `test.skip("<id> — NOT IMPLEMENTED")` (node:test reports it as skipped, never
// as a pass) that the README counts separately from the assertable rows. The
// classification lives here ONCE — the emitted spec and the README census both
// call oracleRowKind(), so a counted row and an emitted row can never drift.
// ---------------------------------------------------------------------------

/** Which honest assertion one A7 oracle row can carry today. */
type OracleRowKind =
  | "endpoint-stub"
  /** fixes/328 P2: the endpoint's job module was emitted REAL — assert the
   *  router→job dispatch end to end instead of the stub refusal. */
  | "endpoint-live"
  /** fixes/328 P2: the job was materialised as a REAL module but no api
   *  surface is importable (tree mode) — assert the module's export surface. */
  | "live-job"
  | "bridged-host"
  | "phase-bookkeeping"
  | "tree-job"
  | "not-implemented";

/**
 * The emitted-module surface the oracle rows are classified against: the api
 * module's route() (endpoint truth), the hosted template module's phase
 * bookkeeping, and the leftover-job bridges (fixes/196). Only .ts modules are
 * ever importable (node:test strip-types cannot load .tsx/JSX).
 */
type OracleRowSurface = {
  /** api node module is importable (non-tree mode, .ts path). */
  apiOk: boolean;
  /** the hosted generatedSource module is importable AND is the template. */
  hostOk: boolean;
  /** leftover job labels bridged to the hosted module — never assert the stub. */
  bridged: ReadonlySet<string>;
  /** fixes/216k D2: tree-covered job labels whose REAL module is importable. */
  jobModules: ReadonlySet<string>;
  /** fixes/328 P2: job labels whose REAL module this emit materialised — the
   *  router dispatches their endpoints to it (assert the dispatch, not a
   *  stub refusal). Empty ⇒ the pre-328 endpoint-stub behavior. */
  wired: ReadonlySet<string>;
  /** A6 contract endpoints (the row's job → a routable seam). */
  endpoints: { method: string; path: string; job: string }[];
};

/** Build the row surface from the emitter's paths (one derivation, no drift). */
function oracleRowSurface(input: {
  /** fixes/144 M2: tree assembly mode ⇒ only the tree entry is importable. */
  treeEntryOk: boolean;
  /** sanitized api node path (null/absent when the graph has no api node). */
  apiPath?: string | null;
  /** path hosting generatedSource (only the template shape is importable). */
  hostPath?: string | null;
  /** true when the hosted module is the deterministic P6 template. */
  template: boolean;
  /** leftover job labels bridged to the hosted module (fixes/196). */
  bridged?: Iterable<string>;
  /** fixes/216k D2: tree-covered job modules (label + path) — .ts only. */
  jobModules?: { label: string; path: string }[];
  /** fixes/328 P2: job labels whose REAL module this emit materialised. */
  wired?: Iterable<string>;
  /** A6 contract endpoints recorded on the project. */
  endpoints?: { method: string; path: string; job: string }[];
}): OracleRowSurface {
  return {
    apiOk:
      !input.treeEntryOk && typeof input.apiPath === "string" && /\.ts$/.test(input.apiPath),
    hostOk:
      !input.treeEntryOk &&
      typeof input.hostPath === "string" &&
      /\.ts$/.test(input.hostPath) &&
      input.template,
    bridged: new Set<string>(input.bridged ? [...input.bridged] : []),
    jobModules: new Set<string>(
      (input.jobModules ?? [])
        .filter((m) => m && typeof m.label === "string" && /\.ts$/.test(String(m.path)))
        .map((m) => m.label),
    ),
    wired: new Set<string>(input.wired ? [...input.wired] : []),
    endpoints: Array.isArray(input.endpoints) ? input.endpoints : [],
  };
}

/**
 * Classify ONE A7 oracle row (see the block comment above). `bridge` wins over
 * the endpoint seam exactly as the pre-fix branch order did: a leftover job
 * that re-exports the hosted module is a bridge, not a stub to reject.
 */
function oracleRowKind(row: { job?: unknown }, surface: OracleRowSurface): OracleRowKind {
  // fixes/216k D2 (parent boundary repair): a tree-covered job module is a REAL
  // importable surface — it wins over the legacy classifications (tree mode
  // disables api/host/bridged anyway, so no pre-216k behavior changes).
  if (surface.jobModules.has(String(row.job))) return "tree-job";
  const bridged = surface.bridged.has(String(row.job));
  const hasEndpoint = surface.endpoints.some((e) => e.job === row.job);
  if (bridged) return surface.hostOk ? "bridged-host" : "not-implemented";
  if (surface.apiOk && hasEndpoint) {
    // fixes/328 P2: a wired job ⇒ the router serves the endpoint for real.
    return surface.wired.has(String(row.job)) ? "endpoint-live" : "endpoint-stub";
  }
  // fixes/328 P2: a real job module with no importable api surface (tree mode).
  if (surface.wired.has(String(row.job))) return "live-job";
  return surface.hostOk ? "phase-bookkeeping" : "not-implemented";
}

/** The row census the README prints: assertable rows vs NOT IMPLEMENTED rows. */
type OracleRowCensus = {
  /** rows that emit a test (non-object rows are skipped by the emitter). */
  total: number;
  /** rows whose emitted test carries a real, failable assertion. */
  assertable: number;
  /** ids emitted as visibly-marked `test.skip("<id> — NOT IMPLEMENTED")`. */
  notImplemented: string[];
};

/** Classify every oracle row once — the emitted spec + the README share this. */
function censusOracleRows(
  rows: ReadonlyArray<Project["oracle"][number]>,
  surface: OracleRowSurface,
): OracleRowCensus {
  const notImplemented: string[] = [];
  let assertable = 0;
  for (const row of rows) {
    if (row === null || typeof row !== "object") continue;
    if (oracleRowKind(row, surface) === "not-implemented") {
      notImplemented.push(typeof row.id === "string" && row.id ? row.id : "(unnamed row)");
    } else {
      assertable += 1;
    }
  }
  return { total: assertable + notImplemented.length, assertable, notImplemented };
}

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
 *   - a row with NO emitted module surface to assert against is emitted as a
 *     visibly-marked test.skip("<id> — NOT IMPLEMENTED") (fixes/216b — 106
 *     T-08 / F-05): never an always-true assertion, reported by node:test as
 *     skipped (never as a pass), and counted separately by the README census;
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
  // fixes/216b (106 T-08 / F-05): the classification surface the row loop below
  // switches on. scaffoldProject passes the very object it counts for the
  // README census; a direct call derives it from the same fields with the same
  // rules (oracleRowSurface), so the two can never disagree.
  const surface: OracleRowSurface =
    ctx.rowSurface ??
    oracleRowSurface({
      treeEntryOk,
      apiPath: ctx.apiPath,
      hostPath: ctx.hostPath,
      template,
      bridged: ctx.bridgedJobLabels,
      jobModules: ctx.treeJobModules,
      wired: ctx.wiredJobLabels,
      endpoints,
    });
  const storeOk =
    !treeEntryOk && typeof ctx.storePath === "string" && /\.ts$/.test(ctx.storePath);
  const apiOk = surface.apiOk;
  const hostOk = surface.hostOk;
  // Mirror the engine's P6 module build: lattice jobs (≤5) or ["core"].
  const expectedJobs = latticeJobs.length ? latticeJobs.slice(0, 5) : ["core"];
  const expectedJson = (v: unknown): string => JSON.stringify(v);
  // fixes/150 (G2): capability-presence row state. Rows exist ONLY when the
  // project carries an implementationSpec with demanded capabilities AND an
  // emitted module surface exists to scan (the tree files in tree mode, else
  // the hosted module path). A project with no capability/requirement rows
  // emits byte-identical output (the fixes/150 byte-parity pin).
  const capDemands = capabilityDemands(project);
  // fixes/328 P2: the REAL per-job modules this emit materialised are part of
  // the emitted product — a capability whose identifier lives there must be
  // scannable, or a real module's capability would read as absent.
  const capJobPaths = (Array.isArray(ctx.wiredJobModules) ? ctx.wiredJobModules : [])
    .filter((m) => m && typeof m.path === "string" && /\.[cm]?ts$/.test(m.path))
    .map((m) => tsImportPath("tests", m.path));
  const capScanPaths: string[] =
    capDemands.length > 0
      ? treeEntryOk
        ? [
            ...(Array.isArray(ctx.treePaths) ? ctx.treePaths : []).map((p) =>
              tsImportPath("tests", p),
            ),
            ...capJobPaths,
          ].filter((p, i, all) => all.indexOf(p) === i)
        : [
            ...(typeof ctx.hostPath === "string" && /\.[cm]?ts$/.test(ctx.hostPath)
              ? [tsImportPath("tests", ctx.hostPath)]
              : []),
            ...capJobPaths,
          ].filter((p, i, all) => all.indexOf(p) === i)
      : [];
  const capSection = capDemands.length > 0 && capScanPaths.length > 0;

  // fixes/216k D2 (parent boundary repair): tree-covered job modules the spec
  // imports so the job-keyed A7 rows assert the REAL module (never a skip).
  // Deterministic names (sanitized label, collision-suffixed); .ts only
  // (strip-types cannot load .tsx). Empty ⇒ byte-identical pre-216k output.
  const treeJobImport = new Map<string, { importName: string; slug: string; path: string }>();
  if (treeEntryOk) {
    const usedNames = new Set<string>(["treeModule"]);
    for (const m of Array.isArray(ctx.treeJobModules) ? ctx.treeJobModules : []) {
      if (!m || typeof m.label !== "string" || typeof m.path !== "string") continue;
      if (!/\.ts$/.test(m.path)) continue;
      if (treeJobImport.has(m.label)) continue; // first wins — graph order, deterministic
      const stem = m.label.replace(/[^A-Za-z0-9_$]/g, "_") || "mod";
      let importName = `jobMod_${stem}`;
      let k = 2;
      while (usedNames.has(importName)) {
        importName = `jobMod_${stem}_${k}`;
        k += 1;
      }
      usedNames.add(importName);
      treeJobImport.set(m.label, {
        importName,
        slug: importName.replace(/^jobMod_/, "jm_"),
        path: m.path,
      });
    }
  }
  // fixes/328 P2: the job modules THIS emit materialised from the recorded API
  // surface. Rows for these assert the module directly (legacy mode uses the
  // stronger route→job dispatch assertion where the api surface is importable).
  const wiredJobImport = new Map<string, { importName: string; slug: string; path: string }>();
  {
    const usedNames = new Set<string>(["treeModule"]);
    for (const v of treeJobImport.values()) usedNames.add(v.importName);
    for (const m of Array.isArray(ctx.wiredJobModules) ? ctx.wiredJobModules : []) {
      if (!m || typeof m.label !== "string" || typeof m.path !== "string") continue;
      if (!/\.ts$/.test(m.path)) continue;
      if (wiredJobImport.has(m.label) || treeJobImport.has(m.label)) continue;
      const stem = m.label.replace(/[^A-Za-z0-9_$]/g, "_") || "mod";
      let importName = `wiredJob_${stem}`;
      let k = 2;
      while (usedNames.has(importName)) {
        importName = `wiredJob_${stem}_${k}`;
        k += 1;
      }
      usedNames.add(importName);
      wiredJobImport.set(m.label, {
        importName,
        slug: importName.replace(/^wiredJob_/, "wj_"),
        path: m.path,
      });
    }
  }

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
    "//   * an oracle row with NO emitted module surface to assert against (106",
    "//     T-08 / F-05) is a visibly-marked test.skip(\"<id> — NOT IMPLEMENTED\") —",
    "//     never an always-true assertion; node:test reports it as skipped (never",
    "//     a pass) and the README counts it separately from the assertable rows;",
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
    ...(treeEntryOk
      ? [...treeJobImport.values()].map(
          (v) => `import * as ${v.importName} from ${jstr(tsImportPath("tests", v.path))};`,
        )
      : []),
    ...(wiredJobImport.size > 0
      ? [...wiredJobImport.values()].map(
          (v) => `import * as ${v.importName} from ${jstr(tsImportPath("tests", v.path))};`,
        )
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
      "  // The import at the top of this spec IS the load assertion: a missing entry",
      "  // or an unresolvable cross-file import fails the spec before any test runs.",
      "  // Export names are generated content — the one stable assertion is that the",
      "  // namespace carries at least one real export. (106 T-08 / F-05: the pre-fix",
      "  // `assert.ok(treeModule)` / `typeof === \"object\"` pair could never fail, so",
      "  // it was removed rather than left to read as evidence.)",
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
  // fixes/216b (106 T-08 / F-05): every row either asserts a real current
  // behavior that can fail, or is a visibly-marked test.skip("<id> — NOT
  // IMPLEMENTED") — never an always-true assertion.
  lines.push(
    "// ---------------------------------------------------------------------------",
    "// 4. Oracle rows (A7) — one test per row under its PINNED id; a row with no",
    "// emitted module surface is a visible test.skip(\"<id> — NOT IMPLEMENTED\")",
    "// (fixes/216b) — skipped, never green, and counted by the README census.",
    "// ---------------------------------------------------------------------------",
    "",
  );
  if (!rows.length) {
    // fixes/216b (106 T-08 / F-05): this row used to be assert.equal(true, true)
    // — a test that cannot fail is not evidence. With no A7 rows there is
    // nothing to assert, so the spec says exactly that with a visible skip.
    lines.push(
      `test.skip("no-oracle: project has no A7 rows yet — run the pipeline to P0/P1", () => {`,
      `  assert.fail("no A7 oracle rows recorded — nothing to assert yet (re-emit after P0/P1)");`,
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
    const kind = oracleRowKind(row, surface);
    // The head is decided from the classification: a row with a real surface
    // keeps the bare pinned id as its test name (E-08 — verified rows match on
    // it); a row without one appends the visible NOT IMPLEMENTED marker.
    const skipRow = kind === "not-implemented" || (kind === "endpoint-stub" && !ep);
    lines.push(
      skipRow
        ? `test.skip(${jstr(`${id} — NOT IMPLEMENTED`)}, () => {`
        : `test(${jstr(id)}, async () => {`,
      `  // A7 row ${jstr(id)} ${name ? `"${name}"` : ""} — ${given} => ${expect}`,
    );
    if (kind === "bridged-host") {
      // leftover job-* re-exports the hosted P6 module (fixes/196) — not a
      // TODO(E-15) stub and not an invented job body. Do not assert the
      // TODO throw. Template host ⇒ same phase bookkeeping as the host.
      lines.push(
        `  // Leftover job ${job} re-exports the hosted P6 module (fixes/196).`,
        `  // Not a TODO(E-15) stub and not an invented job body. Executable`,
        `  // rule today: the hosted module's phase bookkeeping.`,
        `  assert.throws(() => synthesize({ name: "x", phase: 13, job: JOBS[0] }), /invalid phase/);`,
        `  assert.throws(() => synthesize({ name: "x", phase: -1, job: JOBS[0] }), /invalid phase/);`,
      );
    } else if (kind === "endpoint-live" && ep) {
      // fixes/328 P2: the emitted router dispatches this recorded endpoint to
      // the job's REAL module. Assert the wiring end to end — a real, failable
      // acceptance probe over the emitted contract, replacing the pre-328
      // stub-refusal assertion for exactly the jobs that became real.
      lines.push(
        `  // Target seam: ${job} (${ep.method} ${ep.path}) — served by the emitted`,
        `  // router, which dispatches to the REAL job module (fixes/328 P2 / TA-15).`,
        `  const ep = ENDPOINTS.find((e) => e.job === ${jstr(row.job)});`,
        `  assert.ok(ep, "endpoint for the row's job must exist (contract drift)");`,
        `  const res = await route(ep.method, ep.path, { id: ${jstr(`${id}-probe`)} });`,
        `  assert.equal(res.ok, true);`,
        `  assert.equal(res.job, ${jstr(row.job)});`,
      );
      if (wantsCheckpoint && storeOk) {
        lines.push(
          `  // The "${expect}" row expects a checkpoint write — the ONE part the real`,
          `  // CheckpointStore can satisfy today:`,
          `  const s = new CheckpointStore();`,
          `  s.write({ phase: 6, status: "sealed", updatedAt: ${jstr(SEAL_DATE)} });`,
          `  assert.equal(s.read(6)?.status, "sealed");`,
        );
      }
    } else if (kind === "live-job") {
      const wj = wiredJobImport.get(String(row.job));
      if (wj) {
        lines.push(
          `  // fixes/328 P2 (TA-15): this job was materialised as a REAL module from`,
          `  // the recorded API surface — assert its real export surface. (No api`,
          `  // surface is importable in this emission, so the route→job dispatch`,
          `  // assertion is not available; the module is asserted directly.)`,
          `  const ${wj.slug} = ${wj.importName} as unknown as Record<string, unknown>;`,
          `  assert.ok(typeof ${wj.slug}.JOB === "string", "job module records its label");`,
          `  assert.ok(Array.isArray(${wj.slug}.ENDPOINTS), "job module records its A6 endpoints");`,
          `  assert.equal(typeof ${wj.slug}.handle, "function", "job module exports the router entry");`,
          `  const ${wj.slug}Fns = Object.keys(${wj.slug}).filter((n) => typeof ${wj.slug}[n] === "function");`,
          `  assert.ok(${wj.slug}Fns.length > 0, "job module exports real functions: " + ${wj.slug}Fns.join(", "));`,
        );
      } else {
        lines.push(
          `  // fixes/328 P2 defensive: classified live-job with no mapped import`,
          `  // (unreachable — the kind derives from the same map). Fail loudly.`,
          `  assert.fail(${jstr(`${id} is NOT IMPLEMENTED — replace this skip with the row's real acceptance assertion`)});`,
        );
      }
    } else if (kind === "endpoint-stub" && ep) {
      lines.push(
        `  // Target seam: ${job} (${ep.method} ${ep.path}). Today it is a TODO(E-15) stub —`,
        `  // the route rejects instead of returning "${expect}". Asserting that real`,
        `  // current behavior: this test FAILS the moment ${job} is implemented,`,
        `  // which is the signal to replace it with the row's real acceptance assert.`,
        `  const ep = ENDPOINTS.find((e) => e.job === ${jstr(row.job)});`,
        `  assert.ok(ep, "endpoint for the row's job must exist (contract drift)");`,
        `  await assert.rejects(route(ep.method, ep.path, {}), /${EMITTED_REFUSAL_CODE} · TODO\\(E-15\\) stub/);`,
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
    } else if (kind === "tree-job") {
      const jm = treeJobImport.get(String(row.job));
      if (jm) {
        lines.push(
          `  // fixes/216k D2 (TA-15): the tree materialised this job as a REAL`,
          `  // module (never a bridge) — assert its export surface and CALL one`,
          `  // real function in a guarded probe. A ReferenceError here is a missing`,
          `  // cross-file binding (a forward call into a later chunk) and fails this`,
          `  // row; any other throw is the real function behaving. Pre-D2: a skip.`,
          `  const ${jm.slug} = ${jm.importName} as unknown as Record<string, (...a: unknown[]) => unknown>;`,
          `  const names = Object.keys(${jm.slug});`,
          `  assert.ok(names.length > 0, "job module exports real names: " + names.join(", "));`,
          `  for (const n of names) assert.equal(typeof ${jm.slug}[n], "function", n + " must be a real function");`,
          `  const first = names[0] ?? "";`,
          `  try {`,
          `    (${jm.slug}[first] as (...a: unknown[]) => unknown)({ payment: 1 });`,
          `  } catch (e) {`,
          `    if (e instanceof ReferenceError) throw e;`,
          `  }`,
        );
      } else {
        lines.push(
          `  // fixes/216k D2 defensive: classified tree-job with no mapped import`,
          `  // (unreachable — the kind derives from the same map). Fail loudly.`,
          `  assert.fail(${jstr(`${id} is NOT IMPLEMENTED — replace this skip with the row's real acceptance assertion`)});`,
        );
      }
    } else if (kind === "phase-bookkeeping") {
      lines.push(
        `  // Row targets ${job || "the phase graph"} — no HTTP endpoint exists for it. The`,
        `  // only executable rule today is the P6 module's phase bookkeeping: an`,
        `  // out-of-range phase is an illegal transition and is rejected.`,
        `  assert.throws(() => synthesize({ name: "x", phase: 13, job: JOBS[0] }), /invalid phase/);`,
        `  assert.throws(() => synthesize({ name: "x", phase: -1, job: JOBS[0] }), /invalid phase/);`,
      );
    } else {
      // fixes/216b (106 T-08 / F-05): the tautological floor is gone. No emitted
      // module surface targets this row (no HTTP endpoint seam, no P6 template
      // host), so it can carry NO real assertion — a test that cannot fail is
      // not evidence. The row is emitted as a VISIBLE skip instead: the pinned
      // id is preserved, node:test reports it as skipped (never as a pass), and
      // the README counts it separately from the assertable rows. The body
      // fails loudly if it is ever un-skipped before the surface lands.
      lines.push(
        `  // NOT IMPLEMENTED: no emitted module surface targets this row yet (106`,
        `  // T-08 / F-05). The pre-fix emission asserted ${jstr(`${id}`)}.length > 0 —`,
        `  // which cannot fail, so it was not evidence; this row is skipped instead.`,
        `  // Replace the skip with the row's real acceptance assertion when the`,
        `  // seam (HTTP endpoint or P6 host) lands.`,
        `  assert.fail(${jstr(`${id} is NOT IMPLEMENTED — replace this skip with the row's real acceptance assertion`)});`,
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
  // fixes/277 (R3-f03 / W-06): partial-emission capability semantics — see
  // OracleSurfaceCtx.partial. One real skip path (below); a non-partial
  // emission's capability section stays byte-identical to the pre-277 output.
  const capPartial = ctx.partial === true;
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
      ...(capPartial
        ? [
            "// fixes/277 (R3-f03 / W-06): this emission carries a PARTIAL synthesis",
            "// tree — a capability whose identifiers appear in NO scanned file names a",
            "// module that was NEVER materialised, so its row SKIPS with that reason",
            "// instead of reddening (the pre-fix 28-red cascade read as product",
            "// failure; the reds were assembly, not the product).",
            "const __capPartial = true;",
            "",
          ]
        : []),
    );
    capDemands.forEach((d, i) => {
      const idName = `capability.${i + 1}`;
      if (capPartial) {
        // R3-f03 (W-06): ONE real skip path on a partial emission. The absence
        // of every demanded form is read as \"this capability's module was never
        // materialised\" and the row SKIPS with the reason — it can still never
        // pass silently (a skip is not a green) and presence still passes.
        // TODO(R3-f03): the full capability→node mapping so the skip reason can
        // name WHICH declared module is missing instead of the proxy wording.
        lines.push(
          `// ${idName} — ${prose(d.label)}`,
          `test(${jstr(idName)}, (t) => {`,
          `  // Demanded identifier forms (content tokens + canonical stems;`,
          "  // stopword-free): presence of ANY of them in the scanned files counts.",
          `  const forms = ${JSON.stringify(d.forms)};`,
          "  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));",
          "  if (__capPartial && carried.length === 0) {",
          "    t.skip(",
          `      ${jstr(`capability.${i + 1} — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping).`)}`,
          "    );",
          "    return;",
          "  }",
          "  // identifiers present — the presence proxy holds (a name is NOT behavior).",
          "});",
          "",
        );
        return;
      }
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

/**
 * vite.config.ts — webapp (react plugin; tsconfig already declares jsx
 * react-jsx) and, per fixes/277 (R3-f06), game (plain config — the game shell
 * is canvas-based and the game devDeps carry NO react/@vitejs/plugin-react, so
 * the webapp config body would break `npm run build` there). Webapp bytes are
 * unchanged from fixes/135.
 */
function emitViteConfig(kind: ProjectKind): string {
  if (kind === "game") {
    return [
      "// ---------------------------------------------------------------------------",
      "// vite.config.ts — emitted by the RapidTool scaffold (fixes/277 R3-f06).",
      "// The game package.json declares vite dev/build/preview scripts; this config",
      "// makes them real: index.html + src/main boot the canvas shell. Plain config",
      "// — the canvas UI has no framework plugin (game devDeps carry none).",
      "// ---------------------------------------------------------------------------",
      'import { defineConfig } from "vite";',
      "",
      "export default defineConfig({});",
      "",
    ].join("\n");
  }
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
        `if (!rootEl) throw new Error(${jstr(emittedRefusal("missing #root element — index.html did not load"))});`,
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
        `if (!rootEl) throw new Error(${jstr(emittedRefusal("missing #root element — index.html did not load"))});`,
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
      `if (!rootEl) throw new Error(${jstr(emittedRefusal("missing #root element — index.html did not load"))});`,
      "const handle = bootGame(rootEl);",
      "void handle; // keep the GameHandle reachable for future HMR/dev wiring",
      "",
    );
  } else {
    lines.push(
      "const rootEl = document.getElementById(\"root\");",
      `if (!rootEl) throw new Error(${jstr(emittedRefusal("missing #root element — index.html did not load"))});`,
      "rootEl.textContent = \"game shell — no spec-graph ui node was emitted; run the pipeline to P0/P1 and re-emit.\";",
      "",
    );
  }
  return lines.join("\n");
}

/**
 * fixes/277 (R3-f06): the direct-execution guard shared by every emitKindEntry
 * flavor — the standard ESM main-module check (process.argv[1] vs this
 * module's own URL). The structured stub stays IMPORTABLE (an import runs
 * nothing — tests/tooling/the oracle spec never trigger it) while the coded
 * refusal fires the moment the entry is actually EXECUTED
 * (`node --experimental-strip-types src/main.ts`, the package bin launcher, or
 * `npm start`).
 */
function directRunGuardLines(): string[] {
  return [
    "// Direct-execution guard (the standard ESM main-module check): main runs ONLY",
    "// when this file is the program being executed — any import (tests, tooling,",
    "// the oracle spec) never triggers it, which is what makes the stub importable.",
    "if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {",
    "  main()",
    "    .then((code) => {",
    "      process.exitCode = code;",
    "    })",
    "    .catch((error: unknown) => {",
    "      console.error(error instanceof Error ? error.message : String(error));",
    "      process.exitCode = 1;",
    "    });",
    "}",
    "",
  ];
}

/**
 * fixes/277 (R3-f06 / W-15): the per-kind RUNNABLE entry the package fields
 * point at — cli-tool (package `bin` launcher spawns this), library (package
 * `main`/`exports` module), service (`npm start`). STRUCTURED stub per the
 * W30 §S2 contract: importable, exports the declared surface, and the coded
 * refusal fires ONLY when the entry is actually executed. The refusal message
 * keeps BOTH test contracts — the canonical `TODO(E-15) stub` marker
 * (scaffold.test.ts:338) and the `RT_E_VALIDATION · ` prefix
 * (emitted-honesty.test.ts:42) — and names the owning row (`R3-f06`).
 */
function emitKindEntry(kind: ProjectKind, project: Project): string {
  const slug = slugName(project.name);
  if (kind === "cli-tool") {
    return [
      ...sourceHeader("src/main.ts", "CLI entry — the runnable program (package bin delegates here)", project, [
        "// argv is REAL: --help prints the usage line and exits 0; every other",
        "// invocation reaches the structured refusal below (RT_E_VALIDATION).",
      ]),
      'import { pathToFileURL } from "node:url";',
      "",
      `const USAGE = ${jstr(`usage: ${slug} [args] — structured stub, the real CLI is not implemented yet`)};`,
      "",
      "export type CliContext = { argv: string[]; env: Record<string, string | undefined> };",
      "",
      "/** The entry contract (E-15 #2): argv in, exit code out. */",
      "export async function main(",
      "  argv: string[] = process.argv.slice(2),",
      "  env: Record<string, string | undefined> = process.env,",
      "): Promise<number> {",
      "  void env; // TODO(R3-f06): thread env into the job modules once implemented.",
      '  if (argv.includes("--help") || argv.includes("-h")) {',
      "    console.log(USAGE);",
      "    return 0;",
      "  }",
      "  // TODO(R3-f06) at this line: parse argv (flags/inputs) and dispatch to the",
      "  // job modules under src/jobs/. The structured refusal below is the only",
      "  // throw in this entry and fires only when the CLI is actually RUN.",
      `  throw new Error(${jstr(emittedRefusal("TODO(E-15) stub: implement the CLI entry per the oracle (R3-f06)"))});`,
      "}",
      "",
      ...directRunGuardLines(),
    ].join("\n");
  }
  if (kind === "service") {
    return [
      ...sourceHeader("src/main.ts", "Service entry — resolves PORT, refuses honestly until implemented", project, [
        "// The PORT wiring is REAL (resolvePort); the listener is not — the",
        "// structured refusal below fires only when the service is started.",
      ]),
      'import { pathToFileURL } from "node:url";',
      "",
      "export type ServiceContext = { env: Record<string, string | undefined>; port: number };",
      "",
      "/** PORT wiring (pure): a valid 1-65535 integer from the environment, else",
      " *  the documented local default 8080 (the .env.example PLACEHOLDER pulls). */",
      "export function resolvePort(env: Record<string, string | undefined> = process.env): number {",
      '  const raw = Number.parseInt(String(env.PORT ?? ""), 10);',
      "  return Number.isInteger(raw) && raw > 0 && raw <= 65535 ? raw : 8080;",
      "}",
      "",
      "/** The service contract (E-15 #2): start listening, return an exit code. */",
      "export async function main(env: Record<string, string | undefined> = process.env): Promise<number> {",
      "  const ctx: ServiceContext = { env, port: resolvePort(env) };",
      "  void ctx; // TODO(R3-f06): listen(ctx.port) + the healthcheck once the body lands.",
      `  throw new Error(${jstr(emittedRefusal("TODO(E-15) stub: implement the service entry per the oracle (R3-f06)"))});`,
      "}",
      "",
      ...directRunGuardLines(),
    ].join("\n");
  }
  // library: the module package.json `main`/`exports` point at.
  return [
    ...sourceHeader("src/main.ts", "Library entry — the module package main/exports point at", project, [
      "// Importable: importing runs nothing. `entry` is real; the implementation",
      "// surface lands behind the structured refusal below.",
    ]),
    'import { pathToFileURL } from "node:url";',
    "",
    "export type LibraryInfo = { name: string; version: string };",
    "",
    "/** Package identity — REAL values off the emitted package.json contract. */",
    `export const entry: LibraryInfo = { name: ${jstr(slug)}, version: "0.0.0" };`,
    "",
    "/** TODO(R3-f06) at this line: the oracle rows name the functions this module",
    " *  must export — add them here; the refusal stands until they are real. */",
    "export async function main(): Promise<number> {",
    `  throw new Error(${jstr(emittedRefusal("TODO(E-15) stub: implement the library surface per the oracle (R3-f06)"))});`,
    "}",
    "",
    ...directRunGuardLines(),
  ].join("\n");
}

/**
 * fixes/277 (R3-f06): the cli-tool package `bin` launcher — a REAL launcher,
 * not a stub. It spawns the TypeScript entry with the same node flags the
 * emitted package.json scripts use (Node >= 22 type stripping — see
 * engines.node), passing argv straight through; the exit code is the entry's.
 * The entry's honest refusal surfaces on stderr the moment the CLI is RUN.
 */
function emitBinLauncher(project: Project): string {
  const slug = slugName(project.name);
  return [
    "#!/usr/bin/env node",
    `// bin/${slug}.mjs — package bin launcher, emitted by the RapidTool scaffold`,
    "// (fixes/277 R3-f06). Delegates to the TypeScript entry (../src/main.ts) with",
    "// the same flags the package scripts use (Node >= 22 type stripping — see",
    "// engines.node). argv passes straight through; the entry's structured stub",
    "// refuses with RT_E_VALIDATION only when the CLI is actually run.",
    'import { spawnSync } from "node:child_process";',
    'import { fileURLToPath } from "node:url";',
    "",
    'const entry = fileURLToPath(new URL("../src/main.ts", import.meta.url));',
    'const run = spawnSync(process.execPath, ["--experimental-strip-types", entry, ...process.argv.slice(2)], {',
    '  stdio: "inherit",',
    "});",
    "process.exit(run.status === null ? 1 : run.status);",
    "",
  ].join("\n");
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

function commandBlock(
  kind: ProjectKind,
  project: Project,
  census: OracleRowCensus | null,
): string[] {
  const notImplemented = census?.notImplemented.length ?? 0;
  const base = [
    "# install + verify the emitted tree (Node >= 22)",
    "npm install",
    "npm run typecheck",
    ...(project.oracle.length
      ? [
          "# oracle spec = REAL assertions over the emitted modules (no todo stubs);",
          "# green means the scaffold modules are intact + every oracle seam is still",
          "# honestly stubbed — a seam test fails the moment that seam is implemented,",
          "# which is the cue to replace it with the row's real acceptance assertion.",
          ...(notImplemented
            ? [
                `# ${notImplemented} row(s) are NOT IMPLEMENTED and appear as skipped in this`,
                "# run (never green) — see the oracle-row census under Honest boundaries",
              ]
            : []),
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

/**
 * fixes/216k (TA-15 done-when 2): the tree-mode job-scope / bridge census the
 * shipped README renders under "Honest boundaries" — the unmaterialised
 * spec-graph job nodes (NEVER bridged: the tree ships no file at their path)
 * and the surviving non-job bridges (thin re-exports of the tree entry, bytes
 * unchanged — now COUNTED). Both lines render only when their list is
 * non-empty, so zero-count emissions stay byte-identical to pre-216k output.
 */
type ReadmeJobScope = {
  unmaterialisedJobs?: { id: string; file: string; label: string | null }[];
  bridgedPaths?: string[];
  /**
   * OV-16 (W23-262): true when this emission really assembled a generatedTree
   * (tree mode). Needed because the unmaterialisedJobs list is EMPTY on a tree
   * whose files cover every job node — without the flag the README could not
   * state that zero-job-node truth on the artifact itself. Absent = legacy mode.
   */
  treeMode?: boolean;
};

function readmeBody(
  project: Project,
  kind: ProjectKind,
  specRows: [string, string][],
  treeRows: [string, string][] = [],
  oracleCensus: OracleRowCensus | null = null,
  treeRefusals: string[] = [],
  jobScope: ReadmeJobScope = {},
): string {
  const files: [string, string][] = [
    ["README.md", "this file — mission + commands"],
    ["DEPLOY.md", "run/test/env/deploy notes (honest local-only framing)"],
    [".env.example", "PLACEHOLDER env template — copy to .env, never commit real values"],
    [
      ".gitignore",
      "keeps an install/build/verify run (node_modules/, dist/, .rapidtool/logs/) out of the review diff",
    ],
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
  // fixes/216b (106 T-08 / F-05): the oracle-row census. A row the emitted
  // modules give no surface to assert against is NOT IMPLEMENTED — emitted as a
  // visibly-marked `test.skip("<id> — NOT IMPLEMENTED")` and counted HERE,
  // separately from the rows that carry a real assertion, so a skipped row can
  // never read as green evidence. Rendered only when the project has rows;
  // backticks are stripped from ids so a hostile row id cannot break the line.
  const censusIds = (ids: string[]): string =>
    ids.map((raw) => `\`${prose(raw).replace(/`/g, "'")}\``).join(", ");
  const oracleRowLine =
    oracleCensus === null
      ? null
      : oracleCensus.notImplemented.length === 0
        ? `- Oracle rows (\`tests/oracle.spec.ts\`): all ${oracleCensus.total} pinned row(s) assert the emitted modules' real current behavior — no NOT IMPLEMENTED skips.`
        : `- Oracle rows (\`tests/oracle.spec.ts\`): ${oracleCensus.assertable} of ${oracleCensus.total} pinned row(s) assert the emitted modules' real current behavior; ${oracleCensus.notImplemented.length} are NOT IMPLEMENTED — emitted as visibly-marked \`test.skip("<id> — NOT IMPLEMENTED")\`, reported by \`npm test\` as skipped (never green): ${censusIds(oracleCensus.notImplemented)}.`;
  // fixes/216d (106 T-04 / F-03): a refused generatedTree row is NEVER a silent
  // drop. The reference to "the oracle-row census under Honest boundaries" in
  // commandBlock is only true when oracleRowLine actually renders (inserted
  // below); a refusal is recorded in the shipped README itself — declared path
  // + reason — so the artifact says which declared file is absent and why.
  // Every entry is single-line (refusal text JSON-escapes paths) and backticks
  // are stripped, so a hostile row cannot break the markdown.
  const refusalLine =
    treeRefusals.length === 0
      ? null
      : `- **${treeRefusals.length} generated tree row(s) were REFUSED and are NOT on disk** (never a silent drop — each declared file below is absent from this scaffold): ${censusIds(treeRefusals)}.`;
  // fixes/216k (TA-15): the tree-mode job-scope / bridge census lines — rendered
  // only when non-empty, so zero-count emissions stay byte-identical to the
  // pre-216k output. Never silent: an unmaterialised job node is named.
  const jobScopeLines: string[] = [];
  if ((jobScope.unmaterialisedJobs?.length ?? 0) > 0) {
    const jobs = jobScope.unmaterialisedJobs as { id: string; file: string; label: string | null }[];
    jobScopeLines.push(
      `- ${jobs.length} declared spec-graph job node(s) were NOT materialised by the generated tree (never bridged — a re-export at a job path would read as a leftover job): ${censusIds(jobs.map((j) => j.file))}.`,
    );
  } else if (jobScope.treeMode === true) {
    // OV-16 (W23-L2): on a CLEAN tree-mode emission the unmaterialised list is
    // empty — the honest zero must be STATED, not left to the reader: the
    // non-empty branch above renders nothing here, and silence would read as
    // "unknown" rather than "every declared job module materialised".
    jobScopeLines.push(
      "- 0 declared spec-graph job node(s) were left unmaterialised by the generated tree (the tree carries every declared job module).",
    );
  }
  if ((jobScope.bridgedPaths?.length ?? 0) > 0) {
    const paths = jobScope.bridgedPaths as string[];
    jobScopeLines.push(
      `- ${paths.length} non-job module(s) are thin bridges to the tree entry (counted, never silent): ${censusIds(paths)}.`,
    );
  }
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
    ...commandBlock(kind, project, oracleCensus),
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
    oracleRowLine,
    refusalLine,
    ...jobScopeLines,
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
// DEPLOY.md (E-27 ship notes — deployNotes is the canonical export name;
// deplyNotes is the legacy-misspelling alias — fixes/309 A3 · M4-16)
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
export function deployNotes(project: Project): string {
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
  // R13-f13 (W31 · T3): the per-kind deploy HANDOFF — commands only, never
  // credentials. This is the "what do I actually type next" layer the prose
  // destination above lacked; it assumes your own account/login outside the
  // repo. Every command here is either backed by a script the emitted
  // package.json declares (dev/build/preview/typecheck/test per PKG_SCRIPTS)
  // or an explicitly-marked vendor example. Nothing in this list was executed
  // or validated by the pipeline — the honesty stamp above governs.
  const kindHandoff: Record<ProjectKind, string[]> = {
    webapp: [
      "npm run build            # vite build → dist/ (declared by the emitted package.json)",
      "npm run preview          # sanity-check the built output locally",
      "# then hand dist/ to your static host, after your own login — e.g.:",
      "#   npx firebase-tools deploy --only hosting      (after `firebase init hosting`)",
    ],
    game: [
      "npm run build            # vite build → dist/",
      "npm run preview          # play the built bundle locally",
      "# then publish dist/ to any static host, after your own login — e.g.:",
      "#   butler push dist <your-user>/<your-game>:html5      (itch.io)",
    ],
    "cli-tool": [
      "npm run typecheck && npm test    # the emitted oracle suite",
      "npm pack --dry-run               # inspect the package contents",
      "# the emitted package.json declares `private: true` — flip it deliberately,",
      "# then publish after your own `npm login`:",
      "#   npm publish --access public",
    ],
    library: [
      "npm run typecheck && npm test    # the emitted oracle suite",
      "npm pack --dry-run               # inspect the package contents",
      "# library trees are emitted NOT private; publish after your own `npm login`:",
      "#   npm publish --access public",
    ],
    service: [
      "npm run typecheck && npm test    # the emitted oracle suite",
      "# no Dockerfile is emitted — containerize yourself (`docker init` scaffolds one),",
      "# then build/push under your own account — e.g.:",
      "#   docker build -t <image> . && docker run -p 3000:3000 <image>",
      "#   gcloud run deploy <service> --source .        (the host reads $PORT; see .env.example)",
    ],
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
    "- Handoff commands (a TEMPLATE — none of it ran here; run from the emitted folder after your own account/login; the scripts used are declared by the emitted package.json):",
    "",
    "```text",
    ...kindHandoff[kind],
    "```",
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
// deplyNotes — legacy-misspelling alias for `deployNotes` (N6-W8 · P4 naming
// pass, fixes/295_p4_sweeps.md; alias direction flipped by fixes/309 A3 ·
// M4-16, taking the 295 migration path: the call site + scaffold.test.ts moved
// to the correct spelling in the SAME change). Back-compat only — every new
// caller uses `deployNotes`.
// ---------------------------------------------------------------------------
export const deplyNotes = deployNotes;

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
 * fixes/277 (R3-f03 / W-06): the machine-readable trail verdicts the emit
 * envelope carries (see `ScaffoldResult.redTree`/`partial`). Read off the
 * project's own durable log rows — the same signals headless's red-tree guard
 * (`treeRunTrail`) and codegen's `partialTreeRefuse` write:
 *
 *   redTree — the LAST tree verdict on the trail is `p6.tree.failure` with no
 *             green run since (`p6.journey.converged` / `p6.tree.tested` /
 *             `p6.tree.tested.skipped`): this artifact is a RECORD of a
 *             failed tree-run, not a verified build. LAST row wins — a tree
 *             repaired to green by a later run reads clean.
 *   partial — a phase-6 `p6.synthesis.refused` on the trail AND real generated
 *             substance exists (`generatedSource` / `generatedTree`): prior
 *             chunks' real files were kept — a PARTIAL tree, neither the
 *             deterministic floor nor a full pass. The oracle spec's
 *             `capability.N` rows then skip-with-reason instead of reddening
 *             (the pre-fix 28-red cascade read as product failure).
 *
 * Pure + never throws (junk rows are skipped); both flags present only when
 * true, so clean emissions stay byte-identical for every existing consumer.
 */
function trailVerdictOf(project: Project): { redTree: boolean; partial: boolean } {
  const rows = Array.isArray(project.logs) ? project.logs : [];
  let redTree = false;
  for (const row of rows) {
    const event = typeof row?.event === "string" ? row.event : "";
    if (event === "p6.tree.failure") {
      redTree = true;
    } else if (
      event === "p6.journey.converged" ||
      event === "p6.tree.tested" ||
      event === "p6.tree.tested.skipped"
    ) {
      redTree = false;
    }
  }
  const refusedPhase6 = rows.some(
    (row) => row !== null && typeof row === "object" && row.event === "p6.synthesis.refused" && row.phase === 6,
  );
  const hasSubstance =
    String(project.generatedSource ?? "").trim().length > 0 ||
    (Array.isArray(project.generatedTree) && project.generatedTree.length > 0);
  return { redTree, partial: refusedPhase6 && hasSubstance };
}

/**
 * Derive the full file tree for one project. Pure: returns {path, body} pairs
 * (the CLI writes them); deterministic: same project ⇒ same bytes. File order:
 * root docs → env/package → .rapidtool → boot files (webapp/game) → game
 * manifest → spec-graph modules in topo order (generatedSource hosted on the
 * first job node) → oracle spec.
 */
export function scaffoldProject(project: Project, options: ScaffoldOptions = {}): ScaffoldResult {
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

  // fixes/277 (A3-f07): resolve the emitted-UI generation hook for this emit —
  // the caller's hook (ScaffoldOptions.uiGeneration) with the default
  // name-dump as the fallback — and track whether a caller's lines actually
  // landed (the `uiGeneration` record on the result below). The wrapper
  // always returns string[] (the default is total), satisfying the hook
  // contract's `null` ("keep the default") without changing emitUi's own
  // coalescing fallback.
  let uiHookRan = false;
  let uiHookApplied = false;
  const uiGeneration: UiGenerationHook = (request) => {
    uiHookRan = true;
    const lines = options.uiGeneration ? options.uiGeneration(request) : null;
    if (lines !== null) {
      uiHookApplied = true;
      return lines;
    }
    return defaultUiGeneration(request);
  };

  // fixes/277 (R3-f03): the emission's trail verdicts (see trailVerdictOf) —
  // consumed by the oracle-spec ctx (`partial` ⇒ capability skip-with-reason)
  // and the result envelope (redTree/partial), both below.
  const verdict = trailVerdictOf(project);

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

  // --- fixes/216b (106 T-08 / F-05): oracle row census ----------------------
  // Classified ONCE, here, BEFORE the README is rendered: the emitted spec and
  // the README census must agree on which A7 rows carry a real assertion. The
  // host the node loop below will write generatedSource to is deterministic
  // (the FIRST job-* node in topo order, else the legacy src/generated.ts
  // fallback — the same rule the loop applies), so it can be named up front.
  const jobLabelOf = (node: { purpose: string }): string | null => {
    const m = node.purpose.match(/["“]([^"”]+)["”]/);
    return m ? collapse(m[1]) : null;
  };
  const generated = (project.generatedSource ?? "").trim();
  /** Path the node loop below will host generatedSource at (null when none). */
  const plannedHostPath: string | null =
    treeMode || !generated
      ? null
      : (() => {
          const firstJob = ordered.find((o) => o.node.id.startsWith("job-"));
          return firstJob
            ? safeNodePath(firstJob.node.file, firstJob.node.id, firstJob.index)
            : "src/generated.ts";
        })();

  // --- 330 Transit: emitted-format integrity ---------------------------------
  // packageJson() below declares `"type": "module"`, and this emitter's own
  // infra (src/main.tsx, tests/oracle.spec.ts, vite.config.ts, the api/store/ui
  // modules) is ESM. A module body assembled VERBATIM from generated substance
  // that still carries CommonJS residue cannot load in that tenant, yet
  // compile-check is a syntactic parse (a CJS body parses fine), the emitted
  // spec imports only its own surfaces, and a webapp's tree-run entry is a
  // UI-shell skip — so the unloadable product would ship with every gate green
  // (reproduced live on a generatedSource-only CJS project: `tree-run` ok:true
  // while `import()` throws TypeError). The emit pipeline's materializer
  // (headless.materializeEmitTree) rewrites stored TREE residue AND — since
  // 331-3 — a lone generatedSource with residue (both convert to an ESM tree
  // before this runs). A DIRECT scaffold caller bypasses that host-side seam
  // (this function is pure + synchronous and cannot import codegen), so the
  // residue still reaches here; that is the case this refuse closes. Never
  // ship bytes that contradict the package we declare — refuse loudly
  // (declare-or-strike).
  const cjsOffenders: string[] = [];
  for (const tf of treeAccepted) {
    if (EMITTED_CODE_EXT_RE.test(tf.path) && CJS_MODULE_RESIDUE_RE.test(tf.source)) cjsOffenders.push(tf.path);
  }
  if (!treeMode && generated && CJS_MODULE_RESIDUE_RE.test(generated)) {
    cjsOffenders.push(plannedHostPath ?? "src/generated.ts");
  }
  if (cjsOffenders.length > 0) {
    return {
      ok: false,
      error: emittedRefusal(
        `assembled generated module body is CommonJS but the emitted package declares "type":"module" — ` +
          `importing it throws "module is not defined in ES module scope", so the emitted product could not load ` +
          `(offending file(s): ${cjsOffenders.slice(0, 5).join(", ")}${cjsOffenders.length > 5 ? `, +${cjsOffenders.length - 5} more` : ""}). ` +
          `Materialize the module to ESM (codegen.materializeImportableTree) before emitting; the emitter refuses rather than ship an unloadable tree.`,
      ),
    };
  }

  /** leftover job labels the loop bridges to that host (fixes/196). */
  const plannedBridgedLabels = new Set<string>();
  if (!treeMode && plannedHostPath) {
    let seenHostJob = false;
    for (const { node } of ordered) {
      if (!node.id.startsWith("job-")) continue;
      if (!seenHostJob) {
        seenHostJob = true; // the host node itself is not a bridge
        continue;
      }
      const label = jobLabelOf(node);
      if (label) plannedBridgedLabels.add(label);
    }
  }

  // --- fixes/328 P2 (TA-15 / P0-04): the recorded API surface + its binding --
  // Parsed ONCE here so the node loop (real job modules), the router
  // (`emitApi`'s dispatch table) and the oracle-row classification all consume
  // the SAME binding — no second derivation can drift.
  const parsedSignatures: ParsedSignature[] = (() => {
    const spec = project.implementationSpec;
    const raw = spec && Array.isArray(spec.typeSignatures) ? spec.typeSignatures : [];
    const out: ParsedSignature[] = [];
    for (const line of raw) {
      const sig = parseTypeSignature(String(line));
      if (sig && !out.some((p) => p.text === sig.text)) out.push(sig);
    }
    return out;
  })();
  /** Spec-graph job nodes the binding may key (label ≥3 chars, mirrors codegen). */
  const bindableJobTargets = ordered
    .map(({ node, index }) => ({
      id: node.id,
      label: jobLabelOf(node),
      path: safeNodePath(node.file, node.id, index),
    }))
    .filter((t): t is { id: string; label: string; path: string } =>
      t.id.startsWith("job-") && t.label !== null && t.label.length >= 3,
    );
  /** Bound signatures per job node (codegen's `bindSignaturesToJobTargets` rule). */
  const boundSignatures = new Map<string, ParsedSignature[]>(
    bindableJobTargets.map((t) => [t.id, []]),
  );
  for (const sig of parsedSignatures) {
    const target = bindableJobTargets.find((t) =>
      sig.name.toLowerCase().includes(t.label.toLowerCase()),
    );
    if (target) boundSignatures.get(target.id)?.push(sig);
  }
  /**
   * Job nodes this emit materialises as REAL modules (see `emitJobModule`):
   * bound signatures AND a path the emit owns. Tree mode never overwrites a
   * tree file (the tree's own bytes win); legacy mode leaves the generatedSource
   * host node to its hosted P6 module (machine-verified code, fixes/135).
   * Empty for the keyless floor (no specRecord ⇒ no recorded surface) — the
   * honest coded refusal stays there, by design.
   */
  const firstHostJobId = ordered.find((o) => o.node.id.startsWith("job-"))?.node.id ?? null;
  const realJobTargets: { id: string; label: string; path: string; signatures: ParsedSignature[] }[] =
    [];
  for (const t of bindableJobTargets) {
    const sigs = boundSignatures.get(t.id) ?? [];
    if (sigs.length === 0) continue;
    if (treeMode ? treeByPath.has(t.path) : generated && t.id === firstHostJobId) continue;
    realJobTargets.push({ id: t.id, label: t.label, path: t.path, signatures: sigs });
  }
  const realJobById = new Map(realJobTargets.map((t) => [t.id, t]));
  /** label → path for the router + oracle classification (deterministic order). */
  const realJobModules: { label: string; path: string }[] = realJobTargets.map((t) => ({
    label: t.label,
    path: t.path,
  }));
  const wiredJobLabels = new Set(realJobTargets.map((t) => t.label));
  // A wired leftover job emits a REAL module, never a bridge — drop it from the
  // planned-bridge census so the oracle rows classify it as the real seam.
  for (const label of wiredJobLabels) plannedBridgedLabels.delete(label);

  /**
   * fixes/216d (106 T-05 / F-03): the module the emitter ACTUALLY writes as the
   * generated entry — the tree ENTRY (tree mode) or the module hosting
   * generatedSource (legacy mode), both resolved above from the same data the
   * node loop consumes. The emitted webapp shell imports exactly this path
   * (relative to its own emitted file); null ⇒ no generated substance at all,
   * so the shell carries no generated import. Pre-fix the shell imported the
   * literal "../generated.ts", which the allow-list refused ⇒ dangling.
   */
  const generatedEntryPath: string | null = treeMode ? treeEntryPath : plannedHostPath;
  /**
   * fixes/216k D2 (TA-15): the JOB modules the generated tree actually
   * materialised — spec-graph job-* nodes whose sanitized path a tree file
   * covers, in graph order, importable (.ts) only (node strip-types cannot
   * load .tsx). Each entry keys its A7 oracle row (row.job === label) to the
   * REAL module file, so the row asserts that module's real export surface
   * instead of skipping. Empty in legacy mode and for uncovered job nodes —
   * both keep byte-identical pre-216k output.
   */
  const treeJobModules: { label: string; path: string }[] = treeMode
    ? ordered
        .filter(({ node, index }) => {
          if (!node.id.startsWith("job-")) return false;
          const path = safeNodePath(node.file, node.id, index);
          return treeByPath.has(path) && /\.ts$/.test(path);
        })
        .map(({ node, index }) => ({
          label: jobLabelOf(node) ?? node.id,
          path: safeNodePath(node.file, node.id, index),
        }))
    : [];
  // The surface the spec's row loop switches on (mirrors the ctx it receives:
  // tree mode imports only the tree entry — plus, per D2, each tree-covered
  // job module — so api/host/bridge surfaces are off there).
  const oracleSurface = oracleRowSurface({
    treeEntryOk: treeMode && typeof treeEntryPath === "string" && /\.ts$/.test(treeEntryPath),
    apiPath: treeMode ? null : apiPath,
    hostPath: treeMode ? null : plannedHostPath,
    template: isTemplateModule(generated),
    bridged: treeMode ? [] : plannedBridgedLabels,
    jobModules: treeJobModules,
    wired: wiredJobLabels,
    endpoints:
      project.contracts && Array.isArray(project.contracts.endpoints)
        ? project.contracts.endpoints
        : [],
  });
  const oracleCensus = proj.oracle.length ? censusOracleRows(proj.oracle, oracleSurface) : null;
  /** fixes/216k D3: tree-mode job nodes the tree did not cover — never bridged
   *  (a bridged job path would keep doctor's census `reexports > 0` forever).
   *  Filled by the spec-graph node loop below; rendered by readmeBody + warnings. */
  const unmaterialisedJobs: { id: string; file: string; label: string | null }[] = [];
  /** fixes/216k: tree-mode non-job nodes bridged to the tree entry (now counted). */
  const bridgedNonJobPaths: string[] = [];

  // --- Root documents + skeleton files -------------------------------------
  // (fixes/216k parent boundary repair: the README push moved BELOW the
  // spec-graph node loop — it renders the job-scope/bridge census arrays the
  // loop fills; emitting it here ran before the loop: TDZ + empty counts.)
  push("DEPLOY.md", deployNotes(proj));
  push(".env.example", envExample(kind));
  push(".gitignore", gitignoreFile());
  push("package.json", packageJson(kind, proj, proj.oracle.length > 0));
  push("tsconfig.json", tsconfigJson(kind, proj.oracle.length > 0));
  push(".rapidtool/project.json", exportProjectJson(project));

  // --- Browser boot files (fixes/135): kinds whose package.json declares
  // vite dev/build scripts get an index.html + entry + vite.config so
  // `npm run dev`/`npm run build` actually run in the emitted dir.
  if (kind === "webapp" || kind === "game") {
    const entryFile = kind === "webapp" ? "src/main.tsx" : "src/main.ts";
    push("index.html", emitIndexHtml(proj, `/${entryFile}`));
    // fixes/277 (R3-f06 / W-15): BOTH vite kinds get their config — webapp
    // with the react plugin (bytes unchanged from fixes/135), game plain
    // (its devDeps carry no framework plugin; the webapp body would break
    // `npm run build` there). emitViteConfig takes the kind.
    push("vite.config.ts", emitViteConfig(kind));
    push(entryFile, emitMainEntry(kind, proj, uiPath ? relSpecifier("src", uiPath) : null));
  }

  if (kind === "game") {
    push("assets/manifest.json", emitGameManifest(proj));
  }

  // --- fixes/277 (R3-f06): per-kind runnable entries ------------------------
  // packageJson DECLARES these paths (cli-tool `bin`; library `main`/`exports`;
  // service `main` + the start script) — emit exactly what it declares so no
  // emitted package field points at a file that was never written.
  // cli-tool: the bin launcher (spawns src/main.ts, argv passthrough) + the
  // entry; library: the importable module entry; service: the `npm start`
  // entry with the real PORT wiring; each entry's structured refusal keeps
  // the canonical TODO(E-15) stub marker + the RT_E_VALIDATION · prefix.
  if (kind === "cli-tool" || kind === "library" || kind === "service") {
    push("src/main.ts", emitKindEntry(kind, proj));
    if (kind === "cli-tool") {
      push(`bin/${slugName(proj.name)}.mjs`, emitBinLauncher(proj));
    }
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

  // 216b: `jobLabelOf` and `generated` are declared ONCE, above, in the oracle-row
  // census block. This second pair was a duplicate in the SAME function scope
  // (TS2451 — Cannot redeclare block-scoped variable), left behind when the census
  // block was inserted ahead of it. Removed; the earlier declarations serve this
  // code too (identical bodies, same `${project.generatedSource}` source).
  let hosted = false;
  let hostPath: string | null = null;
  const bridgedJobLabels = new Set<string>();
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
      // fixes/216k D3 (TA-15 / 106 F-10): a spec-graph JOB node the generated
      // tree does not cover is NEVER bridged. `doctor --tree` classifies any
      // `src/jobs/*.ts` re-export as a leftover job, so a bridged job path
      // would keep `reexports > 0` (and the factory latch false) no matter how
      // real the tree-covered job modules are — exactly the artifact TA-15
      // removes. The node gets NO file; it is counted + surfaced (warnings +
      // shipped README line) as an unmaterialised job node, never silently.
      if (isJob) {
        // fixes/328 P2: a job node with a bound recorded API surface becomes a
        // REAL module — materialisation, not a bridge (so the D3 rule "never
        // bridge a job node" holds: no re-export is ever written). Jobs with
        // no recorded surface stay counted as unmaterialised, never silent.
        const realJob = realJobById.get(node.id);
        if (realJob) {
          push(
            path,
            emitJobModule(
              { file: path, purpose: node.purpose, id: node.id },
              proj,
              realJob.label,
              realJob.signatures,
              (proj.contracts?.endpoints ?? []).filter((e) => e.job === realJob.label),
              proj.oracle.filter((r) => r.job === realJob.label).map((r) => String(r.id)),
            ),
          );
          continue;
        }
        unmaterialisedJobs.push({ id: node.id, file: path, label: jobLabelOf(node) });
        continue;
      }
      if (node.id === "ui") {
        body = emitUi(
          node,
          proj,
          kind,
          generatedEntryPath ? { from: path, path: generatedEntryPath } : null,
          uiGeneration,
        );
      } else {
        body = emitTreeBridge(
          { file: path, purpose: node.purpose, id: node.id },
          proj,
          treeEntryPath as string,
        );
        // fixes/216k: the surviving bridge policy — a NON-job uncovered node
        // keeps its thin re-export byte-for-byte; the set is now COUNTED so
        // the summary + shipped README can surface it (never silent either).
        bridgedNonJobPaths.push(path);
      }
      push(path, body);
      continue;
    }
    if (node.id === "schema") {
      body = emitSchema(node, proj);
    } else if (node.id === "api") {
      // fixes/328 P2: the router dispatches to the REAL job modules emitted
      // this run (empty for the keyless floor ⇒ the pre-328 refusal bytes).
      body = emitApi(node, proj, { apiPath: path, jobModules: realJobModules });
    } else if (node.id === "store") {
      body = emitStore(node, proj);
    } else if (isJob) {
      const realJob = realJobById.get(node.id);
      if (realJob) {
        // fixes/328 P2: this job has a recorded API surface — emit the REAL
        // module instead of a stub or a re-export bridge of one shared file.
        body = emitJobModule(
          { file: path, purpose: node.purpose, id: node.id },
          proj,
          realJob.label,
          realJob.signatures,
          (proj.contracts?.endpoints ?? []).filter((e) => e.job === realJob.label),
          proj.oracle.filter((r) => r.job === realJob.label).map((r) => String(r.id)),
        );
      } else if (generated && !hosted) {
        body = emitGeneratedHost(node, proj, generated);
        hosted = true;
        hostPath = path;
      } else if (generated && hosted && hostPath) {
        // leftover job-* after the hosted generatedSource: re-export the
        // hosted module (fixes/196). Never a TODO throw stub and never an
        // invented job body (flip/record/show/publish). Keyless (no
        // generatedSource) leftover jobs stay emitJobStub below.
        body = emitTreeBridge(
          { file: path, purpose: node.purpose, id: node.id },
          proj,
          hostPath,
        );
        const label = jobLabelOf(node);
        if (label) bridgedJobLabels.add(label);
      } else {
        body = emitJobStub(node, proj, jobLabelOf(node));
      }
    } else if (node.id === "ui") {
      body = emitUi(
        node,
        proj,
        kind,
        generatedEntryPath ? { from: path, path: generatedEntryPath } : null,
        uiGeneration,
      );
    } else {
      body = emitJobStub(node, proj, jobLabelOf(node));
    }
    push(path, body);
  }

  // fixes/216k (parent boundary repair): README is BUILT after the node loop
  // (it renders the job-scope/bridge census those arrays fill) but ORDERED
  // first, preserving the pre-216k emitted-file order byte-for-byte.
  push(
    "README.md",
    readmeBody(proj, kind, specRows, treeDocRows, oracleCensus, treeRefusals, {
      unmaterialisedJobs,
      bridgedPaths: bridgedNonJobPaths,
    }),
  );
  files.unshift(files.pop() as ScaffoldFile);
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
  // (store/api/template surfaces are generated content with unknown exports)
  // plus, per fixes/216k D2, each tree-covered JOB module so every job row can
  // assert the real module the tree materialised for it.
  if (proj.oracle.length > 0 || ordered.some((o) => o.node.id === "tests")) {
    push(
      "tests/oracle.spec.ts",
      treeMode
        ? emitOracleSpec(proj, {
            treeEntryPath,
            treePaths: treeAccepted.map((f) => f.path),
            treeJobModules,
            // fixes/328 P2: tree-mode job nodes materialised as REAL modules.
            wiredJobLabels,
            wiredJobModules: realJobModules,
            // fixes/277 (R3-f03): a partial tree ⇒ capability rows skip with
            // their reason instead of asserting (non-partial bytes unchanged).
            partial: verdict.partial,
          })
        : emitOracleSpec(proj, {
            storePath,
            apiPath,
            hostPath,
            bridgedJobLabels,
            wiredJobLabels,
            wiredJobModules: realJobModules,
            partial: verdict.partial,
          }),
    );
  }

  // fixes/216k (TA-15 done-when 2): the D3 count/surface for TREE mode —
  // unmaterialised spec-graph job nodes (each NEVER bridged; one warning row
  // apiece) and the surviving non-job bridges (bytes unchanged, now counted).
  // Both render in the shipped README and the CLI-facing summary. Zero counts
  // in both ⇒ byte-identical pre-216k output for every existing fixture.
  const unmaterialisedWarnings = unmaterialisedJobs.map(
    (j) =>
      `specGraph:unmaterialised-job:${JSON.stringify(j.file)}:${
        j.label ? `job ${JSON.stringify(j.label)}` : j.id
      } has no generated tree file — tree mode NEVER bridges a job node (fixes/216k D3 / TA-15)`,
  );
  const summary = treeMode
    ? `${files.length} files · kind ${kind} · packet ${project.id || "unknown"} — tree files already on disk · generatedTree: ${treeAccepted.length} file${treeAccepted.length === 1 ? "" : "s"} assembled${treeRefusals.length ? `, ${treeRefusals.length} refused (see warnings)` : ""}${unmaterialisedJobs.length ? `, ${unmaterialisedJobs.length} job node${unmaterialisedJobs.length === 1 ? "" : "s"} unmaterialised (never bridged — see warnings)` : ""}${bridgedNonJobPaths.length ? `, ${bridgedNonJobPaths.length} non-job bridge${bridgedNonJobPaths.length === 1 ? "" : "s"}` : ""}`
    : `${files.length} files · kind ${kind} · packet ${project.id || "unknown"} — write them to disk with the emit command`;
  const warnings = [...treeRefusals, ...unmaterialisedWarnings];
  // fixes/277 (A3-f07): the UI-generation record — present only when a webapp
  // UI shell was actually emitted this run (the hook ran); `applied` is true
  // when a caller hook's lines replaced the default name-dump. Absent for
  // every other kind/path, so existing consumers keep byte-identical output.
  const uiGenerationRecord =
    uiHookRan && uiPath !== null
      ? {
          hook: uiHookApplied ? ("caller" as const) : ("default-name-dump" as const),
          applied: uiHookApplied,
          uiPath,
        }
      : undefined;
  return {
    ok: true,
    files,
    summary,
    ...(warnings.length ? { warnings } : {}),
    // fixes/277 (R3-f03 / W-06): trail verdicts — present only when true.
    ...(verdict.redTree ? { redTree: true as const } : {}),
    ...(verdict.partial ? { partial: true as const } : {}),
    ...(uiGenerationRecord ? { uiGeneration: uiGenerationRecord } : {}),
  };
}
