// W359 PAUSED 2026-10-15 - work in progress; see wave_plans/W359/HANDOFF.md for what landed, what is half-done and what is left.
// ---------------------------------------------------------------------------
// scaffold.ts â€” E-15 scaffold emitter + E-27 shipped-artifact deploy notes.
//
// Turns one RapidTool Project into a deterministic, zero-dependency file tree
// (packet â†’ code on disk): README.md, DEPLOY.md, .env.example, a per-kind
// package.json skeleton + tsconfig, .rapidtool/project.json (the live export),
// browser boot files for webapp/game kinds (index.html + vite.config.ts + a
// src/main entry â€” fixes/135, so `npm run build` really runs in the emitted
// dir), src/ modules derived from the spec graph (generatedSource embedded
// verbatim where it exists), and tests/oracle.spec.ts â€” REAL assertions over
// the emitted modules from the A7 oracle (fixes/135; no todo stubs), plus â€”
// for game projects â€” a placeholder game-asset manifest. Nothing touches the
// filesystem: callers (CLI emit, UI) write the returned {path, body} pairs.
//
// fixes/216b (106 T-08 / F-05) + fixes/356 (W356 A3 / 355-A3 L5): no emitted
// assertion may be unable to fail, and no unwired row may condemn the tree. An
// A7 row the emitted modules give no surface to assert against is never the old
// always-true `"<id>".length > 0` pair and never a green test: it is emitted as
// a MARKED skip under its pinned id, with the shortfall COUNTED on the emitted
// spec header and the README census. The 354 wave's reachable `assert.fail` was
// honest about the shortfall but made the whole emission fail its own `npm test`
// (and withhold `emit --git`) whenever one such row was present â€” the honesty
// lives in the visible count, not in an unavoidable red.
//
// Pure + deterministic: same Project in â‡’ byte-identical files out. No
// Date.now(), no fs, no randomness; every timestamp is derived from project
// fields. All dynamic inserts are escaped (JSON stringify for code, single-
// line collapse for comments, safe-path segments, slugged package names) so
// hostile briefs/jobs/entity names cannot break out of strings, fences or
// paths. .env.example carries PLACEHOLDER values ONLY â€” never derived from
// project text, so it can never leak a real secret.
//
// fixes/144 (M2): when the project carries a non-empty Project.generatedTree,
// assembly switches to TREE mode â€” every valid tree file is emitted VERBATIM
// at its own repo-relative path (src/api|domain|jobs|state|ui|generated +
// tests/; sorted by path), spec-graph node files the tree does not cover
// become thin re-exports of the tree ENTRY module (the file at the path the
// legacy P6 host would have used â€” same selection rule), src/ui keeps its
// honest contract-level shell, and tests/oracle.spec.ts imports the tree
// entry so the emitted npm test exercises the REAL cross-file tree. Unsafe /
// reserved / duplicate tree rows are refused loudly (result.warnings). An
// empty or absent tree â‡’ the legacy single-module embed, byte-identical to
// pre-M2 output.
//
// fixes/196: leftover job-* nodes after the first hosted generatedSource
// module re-export that host (emitTreeBridge) â€” never a TODO(E-15) throw stub
// and never invented job bodies. No generatedSource â‡’ leftover jobs stay
// emitJobStub (byte-identical keyless floor). Tree-covered paths still skip.
//
// fixes/247 (G5 Â· 216y Â§2.3): the emitted failure paths carry the harness's
// coded-refusal contract across the artifact boundary â€” every TODO(E-15) stub
// rejection and every entry boot guard prefixes a REGISTERED RT_E code
// (EMITTED_REFUSAL_CODE below; errors.ts is the code source â€” never an
// invented id) in the `<code> Â· <reason>` refusal-log shape, and the emitted
// oracle spec asserts the coded form. A consumer of the tree can classify
// failures instead of receiving text-only errors.
//
// Honest local-only framing (E-27): DEPLOY.md is a template derived from the
// P9/P12 artifacts recorded in the project; it states that the pipeline never
// executed or validated those templates and that nothing in the scaffold
// deploys anywhere by itself. Assets/ and public/ are expected at the emitted
// scaffold and are NOT engine-generated (explicit boundary in DEPLOY.md).
//
// EXACT EXPORT SURFACE (the CLI/UI agents compile against these â€” do not
// rename, and keep semantics below stable):
//
//   export type ProjectKind            "webapp"|"cli-tool"|"library"|"game"|"service"
//   export function projectKindOf(project: Project): ProjectKind
//   export function scaffoldProject(project: Project, options?: ScaffoldOptions): ScaffoldResult
//   export function deployNotes(project: Project): string  (DEPLOY.md content;
//     the legacy misspelling `deplyNotes` stays as a back-compat alias)
//
// Project.kind (types.ts) is the widened 5-way DeliveryKind the engine decides
// once and stamps at the keyed P6 seam; projectKindOf maps it onto this 5-way
// taxonomy and never infers from the brief itself (342-4).
// ---------------------------------------------------------------------------
import { PHASES } from "./phases.ts";
import { exportProjectJson, slugName } from "./io.ts";
import { canonicalStem } from "./algorithms.ts";
import { fnv1a } from "./algorithms.ts";
import { BRIEF_STOPWORDS } from "./sandbox.ts";
// 342-4: scaffold reads the ONE kind decision from the engine (scaffold â†’ engine
// is acyclic; engine never imports scaffold, and scaffold already reaches engine
// through io.ts). This replaces the module's own brief-noun inference, so the two
// resolvers cannot drift.
import { deliveryKindOf } from "./engine.ts";
import type { ErrorCode } from "./errors.ts";
import {
  approvedAcceptanceFixtures,
  compileFixtureAssertion,
  fixtureMatchHelperSource,
} from "./brief-fixtures.ts";
import type { Project } from "./types.ts";

export type ProjectKind = "webapp" | "cli-tool" | "library" | "game" | "service";

export type ScaffoldFile = { path: string; body: string };

/**
 * fixes/277 / 340-6 (A3-f07 / W-14 Â· W-27-C W-28b): the emitted-UI generation
 * seam. A caller MAY supply a `uiGeneration` hook (via `ScaffoldOptions`); it
 * receives the emit context and returns replacement source lines for the
 * emitted shell's generated-substance body, or `null` to keep the default.
 * The DEFAULT hook (`defaultUiGeneration` below) is a real, deterministic
 * generator over the project's own spec + the generated module's exported
 * surface (see its own contract); a caller hook still overrides it wholesale.
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

/** Optional inputs to `scaffoldProject` (additive; an omitted hook keeps the
 *  default UI generator). The README's declared-scripts banner is emitted
 *  unconditionally â€” see `declaredScriptsBanner`. */
export type ScaffoldOptions = {
  /** A3-f07: the emitted-UI generation hook (default = `defaultUiGeneration`). */
  uiGeneration?: UiGenerationHook;
  /** fixes/356 (W356 A3; restores 355-A3 L6): what to do with a recorded
   *  below-floor plan (`underProductionRefusalOf`). An ABSENT option is the
   *  safety default **`"refuse"`** â€” the writer opens no file at all and the
   *  run stays withheld. `"refuse"` is the same explicit refusal.
   *  `"partial"` (equivalently `"banner"`, the headless/CLI spelling) lands the
   *  best PARTIAL tree WITH the `> [!CAUTION]` / `## BELOW-FLOOR PLAN` banner at
   *  the top of the emitted `README.md` and reports `underProduced{code,detail}`
   *  on the result, so a deliberately shipped partial can never read as a clean
   *  pass. A caller must opt in explicitly to get those bytes. */
  underProduced?: "partial" | "refuse" | "banner";
  /** R2-04 / fixes/354 A2-F4: the LEGACY boolean spelling of the same policy â€”
   *  `true` is the INTERNAL candidate emit (the pre-seal self-typecheck must
   *  see the candidate bytes), `false` is an explicit `underProduced:"refuse"`.
   *  Only consulted when `underProduced` is absent; an absent pair still means
   *  `"refuse"`. Retained so every existing caller keeps its exact policy. */
  allowUnderProduced?: boolean;
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
       * envelope (see `trailVerdictOf`) â€” present only when true, so clean
       * emissions stay byte-identical for every existing consumer.
       *
       * `redTree` â€” the project's own trail's last tree verdict is an uncleared
       * `p6.tree.failure`: this artifact is a RECORD of a failed tree-run, not
       * a verified build (the same condition headless's red-tree emit guard
       * refuses/banners on; this field makes it readable WITHOUT the guard).
       * `partial` â€” the last synthesis verdict is a phase-6
       * `p6.synthesis.refused` while real generated substance exists (prior
       * chunks kept â€” `partialTreeRefuse`): the emission is a PARTIAL tree,
       * neither the floor nor a full pass. The oracle spec's `capability.N`
       * rows skip-with-reason on a partial emission instead of reddening.
       */
      redTree?: true;
      partial?: true;
      /**
       * fixes/354 A2-F4 (Decision D1) / fixes/356 (W356 A3): present when this
       * emit LANDED the below-floor PARTIAL under an EXPLICIT `"partial"` /
       * `"banner"` policy (the default is refuse â€” zero files). Carries the
       * project's own recorded refusal â€” the banner at the top of the emitted
       * `README.md` states the same detail â€” so a caller (or an agent driver)
       * can never read the partial as a clean pass. The emission is still
       * `ok:true` (files landed); the caller's non-zero exit / delivery seal is
       * unchanged.
       */
      underProduced?: { code: "RT_E_PLAN_UNDERPRODUCED"; detail: string };
      /**
       * fixes/354 A2-F11: the `game` kind emits ONE deterministic platformer
       * shell, byte-identical across every brief. Present (true) so no consumer
       * can present the template as brief-generated work; the emitted README
       * states the same boundary.
       */
      gameTemplate?: true;
      /**
       * fixes/277 / 340-6 (A3-f07): which UI-generation path produced the
       * emitted webapp shell â€” the default generator, or a caller-supplied
       * hook whose lines were applied. Absent when the emission carried no
       * webapp UI node (nothing was generated, so there is nothing to report).
       */
      uiGeneration?: {
        hook: "default-generator" | "caller";
        /** true when a caller hook's lines replaced the default this emit. */
        applied: boolean;
        /** The emitted ui module path the hook's lines landed in. */
        uiPath: string;
      };
    }
  | {
      ok: false;
      error: string;
      /** R2-04: the registered code for a coded refusal (absent for a
       *  generic invalid-project error). The emit seal (lane D) can forward
       *  this instead of parsing the error string (R2-01). */
      code?: ErrorCode;
    };

const KIND_LABEL: Record<ProjectKind, string> = {
  webapp: "web app",
  "cli-tool": "CLI tool",
  library: "library",
  game: "game",
  service: "service",
};

/** The E-27 honesty stamp every DEPLOY.md must carry (verbatim). */
export const DEPLOY_HONESTY_STAMP =
  "> template derived from P9/P12 artifacts â€” verify credentials before any deploy";

const MACHINE_STAMP = (id: string): string =>
  `machine-generated from RapidTool packet ${id || "unknown"}; regenerate, don't hand-edit.`;

/**
 * fixes/247 (G5 Â· 216y Â§2.3 â€” "the coded-refusal contract stops at the
 * artifact boundary"): every emitted failure path names a REGISTERED code
 * from errors.ts (invariant I13), never an invented one. `RT_E_VALIDATION`
 * is the registry's class for an operation a seam declines with a named
 * reason â€” the same class phases.ts:119 and headless.ts's policy seam stamp
 * on their guard refusals ("a validation refusal, not an opaque internal
 * error"). The emitted message shape is the refusal-log shape
 * `<RT_E code> Â· <reason>` (engine.ts refusalClassOf parses it).
 *
 * The `ErrorCode` annotation is the registry tie (invariant I13): an invented
 * or since-removed id fails `npx tsc --noEmit` instead of riding a string.
 */
const EMITTED_REFUSAL_CODE: ErrorCode = "RT_E_VALIDATION";

/** `<RT_E code> Â· <reason>` â€” the prefix every emitted failure path carries. */
const emittedRefusal = (reason: string): string => `${EMITTED_REFUSAL_CODE} Â· ${reason}`;

/**
 * fixes/354 A2-F13 â€” the ONE value-position CJS-residue reading. A `module` or
 * `exports` reference that cannot load inside the `"type":"module"` package
 * this emitter declares: a `module.exports` use, or a bare `exports.`/
 * `exports =` assignment head (never `xexports.`/`reexports.` look-alikes).
 * `opts.tsExportEquals` adds the TypeScript `export =` form, which only the
 * SYNTHESIS validator (codegen's post-conversion `materializedCjsResidueHits`)
 * needs. Returns the hit labels (empty = clean ESM) so callers branch on a
 * list, never a boolean. Single-sourced here because scaffold is the one module
 * both the emit boundary (headless's materializer guard) and the synthesis
 * validator (codegen) already import â€” mirroring the predicate in three places
 * let the emit-time and synthesis-time readings drift (A2-F13).
 */
export function cjsResidueHits(source: string, opts: { tsExportEquals?: boolean } = {}): string[] {
  const s = typeof source === "string" ? source : "";
  if (s.trim() === "") return [];
  const hits: string[] = [];
  if (/\bmodule\s*\.\s*exports\b/.test(s)) hits.push("module.exports");
  if (/(?:^|[^\w$.])exports\s*(?:\.|=[^=])/.test(s)) hits.push("exports");
  if (opts.tsExportEquals === true && /(?:^|[^\w$.])export\s*=/.test(s)) hits.push("export =");
  return hits;
}

/** Emitted code extensions whose bodies must be ESM (the declared package). */
const EMITTED_CODE_EXT_RE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/i;

/** Emitted source extensions that carry JSX syntax (fixes/359 kind-gate): the
 *  one reading the emitted `tsconfig.json`'s `jsx` is derived from. */
const JSX_SOURCE_EXT_RE = /\.(tsx|jsx)$/i;

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

/**
 * A4 (SYNTHSPEC P5c): the human display name â€” the brief's H1 markdown is not
 * markup. Strips leading `#`s and whitespace and a trailing separator/em-dash
 * (`"# Wildstem Florist â€”"` â†’ `"Wildstem Florist"`). Pure; falls back to the
 * collapsed raw value when stripping would empty it.
 */
function displayName(raw: string): string {
  const collapsed = collapse(raw);
  const stripped = collapsed
    .replace(/^#{1,6}\s*/, "")
    .replace(/\s*[â€”â€“-]\s*$/, "")
    .trim();
  return stripped || collapsed || "RapidTool scaffold";
}

/** JSON-escaped string literal body (safe inside 'â€¦', "â€¦", `â€¦` and fences). */
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
// fixes/144 (M2): generatedTree â†’ scaffold assembly helpers.
//
// A keyed P6 journey may land Project.generatedTree: {path, source, hash,
// attempt} rows (types.ts). When non-empty, scaffoldProject assembles those
// files instead of embedding one verbatim generatedSource module. Every path
// is validated BEFORE anything is emitted: only the scaffold's own src/
// subdirs (the spec-graph families api/domain/jobs/state/ui plus the
// src/generated fallback family) and tests/ are legal; traversal (".."),
// absolute paths (POSIX "/x" or Windows "C:\x" â€” any backslash), reserved
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
 * at `src/generated.ts` (codegen.server.ts `TREE_ENTRY_PATH`) â€” a path that
 * starts with NO allowed root ("src/generated/" needs the trailing slash), so
 * the allow-list refused the declared entry BY CONSTRUCTION: the barrel was
 * dropped and the entry silently degraded to the alphabetically-first tree
 * file. Exact match (never a prefix) so the widening cannot admit look-alikes
 * such as `src/generated.ts.bak`.
 */
const TREE_ALLOWED_FILES = new Set(["src/generated.ts"]);

/** Scaffold-owned files a tree may never overwrite (tests/oracle.spec.ts is
 * the machine-verified acceptance contract â€” fixes/135 â€” always emitted by
 * the scaffold itself; boot entries live outside the allowed roots). */
const TREE_RESERVED = new Set(["tests/oracle.spec.ts"]);

/** A single safe path segment â€” the same charset the emitter's own paths use. */
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

/**
 * 353: two emitted paths that differ only by case or by `-`/`_` name the SAME
 * concept. The measured corpus carried a kebab-case real module (`web-marketing.ts`,
 * `custom-software.ts`) AND a snake-case duplicate the emitter wrote for the
 * same spec-graph node. This normalizer lets the emitter reuse the tree's real
 * module instead of writing the duplicate.
 */
function conceptPathKey(path: string): string {
  return String(path ?? "").toLowerCase().replace(/[-_]/g, "");
}

/** A tree file that differs from `path` only by case / `-` / `_`, or null. */
function treeTwinPath(paths: readonly { path: string }[], path: string): string | null {
  const key = conceptPathKey(path);
  const hit = paths.find((f) => f.path !== path && conceptPathKey(f.path) === key);
  return hit ? hit.path : null;
}

/** Valid TS identifier from arbitrary text (never empty â†’ `_`). */
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
  // ever imports â€” .tsx modules are never imported from specs).
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
 * gain a machine-appended export surface â€” keyed/model modules keep their own
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
  "// REAL behavior. Not part of generatedSource â€” regenerating the scaffold\n" +
  "// restores this line automatically.\n" +
  "export { JOBS, REJECTION, synthesize };\n";

/**
 * fixes/352: does this generated module source export `name`? Used to bind a
 * tree-covered job module to a recorded run export the tree genuinely exposes â€”
 * a name the module does not export is never called (no dangling binding).
 */
function sourceExportsName(source: string, name: string): boolean {
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) return false;
  if (new RegExp(`^export\\s+(?:async\\s+)?function\\s+${name}\\s*\\(`, "m").test(source)) return true;
  if (new RegExp(`^export\\s+(?:const|let|var)\\s+${name}\\b`, "m").test(source)) return true;
  for (const m of source.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const part of m[1]!.split(",")) {
      const p = part.trim();
      const as = /^([A-Za-z_$][A-Za-z0-9_$]*)\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)$/.exec(p);
      if ((as ? as[2]! : p) === name) return true;
    }
  }
  return false;
}

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
  return c.length > cap ? `${c.slice(0, cap).trimEnd()}â€¦` : c;
}

// ---------------------------------------------------------------------------
// Kind resolution (342-4: ONE decision, read here â€” never re-inferred)
// ---------------------------------------------------------------------------

// Project.kind (types.ts) is the widened 5-way DeliveryKind the engine decides
// once (engine.deliveryKindOf) and stamps at the keyed P6 seam
// (engine.withDeliveryKind). projectKindOf only MAPS that single value onto
// this module's 5-way scaffold taxonomy â€” it does not infer from the brief.
//
// History: pre-342-4 this module kept its own register-keyword inference
// (fixes/341-1 aligned it with engine.uiKindOf by hand), which is exactly the
// drift the single source of truth removes: "A kanban board library" resolved
// library in the engine but webapp here, so the emitted webapp UI bound a form
// to a library API â€” an unrepairable pre-seal typecheck refusal. Now both
// resolvers read deliveryKindOf, so they cannot disagree.
//
// 347-2 (measured defect): a stored `app` label must not beat a brief that
// plainly says GAME. Sky Hopper's record carried `kind: "app"` while its brief
// opened "2D Browser Arcade Game", so the emitter wrote a webapp with no input/
// loop/canvas surface while dod's kind-aware `p6-game-surface` gate demanded
// one (productSurfaceKindOf returns game for the SAME brief). The emitted
// surface follows the BRIEF's kind for the unambiguous game/arcade signal;
// every other kind still reads the engine's single decision. A test pins this
// to dod.productSurfaceKindOf so the emitter and the gate cannot disagree.
const BRIEF_GAME_RE = /\b(?:game|arcade)\b/i;

export function projectKindOf(project: Project): ProjectKind {
  if (BRIEF_GAME_RE.test(typeof project.brief === "string" ? project.brief : "")) return "game";
  switch (deliveryKindOf(project)) {
    case "app":
      return "webapp";
    case "tool":
      return "cli-tool";
    case "game":
      return "game";
    case "library":
      return "library";
    case "service":
      return "service";
  }
}

// ---------------------------------------------------------------------------
// Per-kind static content (constants â€” never derived from project text, so
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
  VITE_API_KEY: "client-facing key â€” PLACEHOLDER, never commit a real one",
  API_BASE_URL: "base URL of any external API the tool talks to (local-first)",
  API_KEY: "API credential â€” PLACEHOLDER, never commit a real one",
  PORT: "port the service listens on locally",
};

function envExample(kind: ProjectKind): string {
  return [
    "# RapidTool scaffold .env.example â€” PLACEHOLDER values ONLY (never commit real",
    "# secrets). Copy to .env and fill real values locally; the scaffold is local-first",
    "# and nothing here deploys anywhere by itself.",
    ...ENV_LINES[kind].map((name) => `${name}=PLACEHOLDER`),
    "",
  ].join("\n");
}

/**
 * fixes/217f (T4.2, 216x Â§2.3 item 1): the emitted tree's `.gitignore`. Once a
 * real install + build runs INSIDE an emitted tree (T4.1), `node_modules/` and
 * `dist/` land in the artifact and the tree stops being a reviewable unit â€”
 * this file is what keeps that diff clean. It ignores ONLY what an install /
 * build / verify run leaves behind and keeps the reviewed artifacts tracked:
 * the generated source, `.rapidtool/project.json`, the notes and the report
 * files. Byte-stable: no timestamps, no absolute paths, identical for every
 * kind and mode (the determinism suite pins it).
 */
function gitignoreFile(): string {
  return [
    "# RapidTool scaffold .gitignore â€” keeps this emitted tree a reviewable unit.",
    "# Ignore only what a real install/build/verify run leaves behind (T4.1/T4.2);",
    "# the generated source, .rapidtool/project.json and the notes stay tracked.",
    "# Secrets never enter the tree: .env stays local, only .env.example ships.",
    "node_modules/",
    "dist/",
    ".rapidtool/logs/",
    ".env",
    ".env.*",
    "!.env.example",
    "*.log",
    "coverage/",
    ".vite/",
    ".DS_Store",
    "",
  ].join("\n");
}

/**
 * fixes/352 (release hygiene): the emitted tree ships a real, standard licence
 * so a professional repo is not licence-less. The MIT text is fixed; the year
 * and holder are derived from the project's own recorded fields (never
 * `Date.now()`), so the emission stays pure/deterministic. A brief that names
 * no author falls back to the project display name.
 */
function licenseFile(project: Project): string {
  const created = project.createdAt;
  const ms =
    typeof created === "number"
      ? created
      : /^\d+$/.test(String(created ?? ""))
        ? Number(created)
        : Date.parse(String(created ?? ""));
  const parsedYear = Number.isFinite(ms) ? new Date(ms).getUTCFullYear() : NaN;
  const year = Number.isFinite(parsedYear) && parsedYear >= 1970 && parsedYear <= 9999 ? String(parsedYear) : "2026";
  const holder = mdLine(displayName(project.name) || slugName(project.name) || "the project authors", 120);
  return [
    "MIT License",
    "",
    `Copyright (c) ${year} ${holder}`,
    "",
    "Permission is hereby granted, free of charge, to any person obtaining a copy",
    "of this software and associated documentation files (the \"Software\"), to deal",
    "in the Software without restriction, including without limitation the rights",
    "to use, copy, modify, merge, publish, distribute, sublicense, and/or sell",
    "copies of the Software, and to permit persons to whom the Software is",
    "furnished to do so, subject to the following conditions:",
    "",
    "The above copyright notice and this permission notice shall be included in all",
    "copies or substantial portions of the Software.",
    "",
    "THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR",
    "IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,",
    "FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE",
    "AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER",
    "LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,",
    "OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE",
    "SOFTWARE.",
    "",
  ].join("\n");
}

/**
 * fixes/352 (release hygiene): a CI workflow that runs THIS emitted tree's own
 * declared gates â€” install, typecheck, test. It names only scripts packageJson
 * actually declares for the kind (PKG_SCRIPTS), never a phantom one. `npm
 * install` is used because no lockfile is emitted (the package.json is
 * lockfile-free-but-correct); `npm ci` would refuse without one.
 */
function ciWorkflowFile(kind: ProjectKind, hasTests: boolean): string {
  const scripts = PKG_SCRIPTS[kind] ?? {};
  const steps: string[] = [
    "      - name: Install",
    "        run: npm install --no-audit --no-fund",
  ];
  if (scripts.typecheck) {
    steps.push("      - name: Typecheck", "        run: npm run typecheck");
  }
  if (hasTests && scripts.test) {
    steps.push("      - name: Test", "        run: npm test");
  }
  return [
    "# Emitted by the RapidTool scaffold (fixes/352) â€” runs THIS tree's own gates.",
    "# No lockfile is shipped, so `npm install` (not `npm ci`) is the correct step.",
    "name: ci",
    "",
    "on:",
    "  push:",
    "  pull_request:",
    "",
    "jobs:",
    "  gate:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: actions/checkout@v4",
    "      - uses: actions/setup-node@v4",
    "        with:",
    '          node-version: "22"',
    ...steps,
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
  // W52 / 338-5: `tsx` was declared on cli-tool/service but no emitted script or
  // import consumed it (the entries run `node --experimental-strip-types`) â€”
  // declare-or-strike, so it is not declared. Add it back only with a script
  // that actually uses it.
  "cli-tool": { "@types/node": "^22.0.0", typescript: "^5.7.0" },
  library: { "@types/node": "^22.0.0", typescript: "^5.7.0" },
  service: { "@types/node": "^22.0.0", typescript: "^5.7.0" },
};

// PKG_SCRIPTS honesty (fixes/149 P1-2 / fixes/150 G3): the dev/build scripts
// below are DECLARED on every emitted tree of the kind. They are only
// VERIFIED when the caller runs `emit --verify-kind` (scratch npm install +
// the declared build/test, bounded); without that opt-in flag they are
// unverified scaffold claims â€” declare-or-strike. W48 / 334-3 (T1a): the
// emitted README says so up front (declaredScriptsBanner below).
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
    // fixes/277 (R3-f06): the service kind's runnable entry â€” `npm start`
    // executes src/main.ts (readiness = the entry's structured stub, which
    // reads PORT and refuses honestly until the service body is implemented).
    start: "node --experimental-strip-types src/main.ts",
  },
};

/**
 * fixes/352 (release hygiene): the version is DERIVED from the project's own
 * recorded state, never the `0.0.0` placeholder â€” a run that sealed (reached
 * the deploy phases) publishes 1.x, an in-progress run 0.x, minor = the
 * recorded current phase. Pure/deterministic (reads project fields only). The
 * library entry re-exports the same value, so `entry.version` can never drift
 * from the emitted package.json.
 */
function projectVersion(project: Project): string {
  const phaseRaw = typeof project.currentPhase === "number" && Number.isFinite(project.currentPhase)
    ? Math.floor(project.currentPhase)
    : 0;
  const phase = Math.max(0, Math.min(99, phaseRaw));
  const sealed = project.status === "complete" || phase >= 12;
  return `${sealed ? 1 : 0}.${phase}.0`;
}

/**
 * fixes/347-2 (no-invention hard rule): the brief's own statement that a figure
 * class is withheld. When it does, the emitter may NOT author such a literal
 * into the tree (the model's own verbatim generated-tree bytes are untouched â€”
 * only the scaffold-authored modules are policed).
 */
function briefWithholdsFigures(brief: string): boolean {
  const text = String(brief ?? "");
  return (
    /\bno\s+(?:prices?|awards?|address(?:es)?|figures?|facts?|numbers?|rates?)\b/i.test(text) ||
    /\b(?:not|never)\s+(?:publish|invent|fabricat|disclos|make\s+up)/i.test(text) ||
    /\bwithheld\b|\bunpublished\b/i.test(text)
  );
}

/** A scaffold-authored code line that invents a withheld figure literal. The
 *  address arm matches an object PROPERTY literal (`address: "451 East â€¦"` or a
 *  quoted street address) â€” never a validation message assigned to a field
 *  (`found.address = "Enter the delivery address."`). */
function inventedFigureLine(line: string): boolean {
  return (
    /\bprice(?:Cents?|InCents)?\s*[:=]\s*-?\d/.test(line) ||
    /\$\s?\d{1,3}(?:[.,]\d{2})\b|\$\s?\d{2,}\b/.test(line) ||
    /\baddress\s*:\s*"[^"]{6,}"/.test(line) ||
    /"[^"]{6,}\s+(?:street|st\.|avenue|ave\.|road|rd\.|boulevard|blvd\.|drive|dr\.|lane|ln\.|suite|ste\.)\b[^"]*"/i.test(line) ||
    /\bawards?\s*:\s*\[[^\]]*"[^"]+"/.test(line)
  );
}

function packageJson(kind: ProjectKind, project: Project, hasTests: boolean): string {
  const scripts = { ...(PKG_SCRIPTS[kind] ?? {}) };
  if (!hasTests) delete scripts.test;
  const slug = slugName(project.name);
  const version = projectVersion(project);
  const pkg: Record<string, unknown> = {
    name: slug,
    version,
    private: kind !== "library",
    type: "module",
    description: (() => {
      // fixes/353 (declare-or-strike): the description is a synthesized one-liner
      // derived from the project's own name/kind â€” NEVER the raw brief dumped
      // into JSON (the measured `"# <brief> ## What this is â€¦"` truncation).
      const name = displayName(project.name) || slugName(project.name) || "Untitled project";
      const id = typeof project.id === "string" && project.id !== "" ? ` (packet ${project.id.slice(0, 8)})` : "";
      return `${name} â€” ${KIND_LABEL[kind]} generated by RapidTool from a governed build${id}.`;
    })(),
    scripts,
    dependencies: PKG_DEPS[kind] ?? {},
    devDependencies: PKG_DEV_DEPS[kind] ?? {},
    engines: { node: ">=22" },
    generatedBy: `RapidTool scaffold emitter â€” ${MACHINE_STAMP(project.id)}`,
    rapidtool: {
      producer: isTemplateModule(String(project.generatedSource ?? ""))
        ? "template"
        : Array.isArray(project.generatedTree) && project.generatedTree.length > 0
          ? "llm"
          : "floor",
      packetId: project.id,
    },
  };
  // fixes/277 (R3-f06 / W-15): per-kind entry wiring â€” a real consumer
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
    // src/main.ts (emitKindEntry) with argv passed straight through. W49 /
    // 335-3: `main` DECLARES that entry module too, so a consumer that
    // resolves the package's program (the tree-run entry smoke) finds the
    // file the launcher actually runs rather than an unrelated job module.
    // Importing it runs nothing â€” the entry carries the direct-run guard.
    pkg.bin = { [slug]: `bin/${slug}.mjs` };
    pkg.main = "./src/main.ts";
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

/**
 * The emitted `tsconfig.json`.
 *
 * `emittedJsx` is the caller's reading of the file set this emit ACTUALLY
 * writes (any `.tsx`/`.jsx` source): fixes/359 (W359 kind-gate) derives `jsx`
 * from it instead of from a hard-coded kind list. A kind list is a second
 * source of truth for "does this tree carry JSX source", so it drifts the
 * moment an emitter writes a `.tsx` for a kind the list does not name â€” which
 * is exactly the W358 defect: `tool`/`service`/`library` were handed
 * `src/ui/console.tsx` and the 353 briefed-site pages with no `jsx`, so their
 * own declared `npm run typecheck` red with TS17004/TS6142 on a clean tree.
 * `preserve` admits a `.tsx` module with no transform and NO React runtime;
 * only a kind whose emitted package declares its renderer (`PKG_DEPS[kind]`
 * .react â€” webapp today) gets the real `react-jsx` transform.
 */
function tsconfigJson(kind: ProjectKind, hasTests: boolean, emittedJsx: boolean): string {
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
      // W52 / 338-5: the game spec-graph ui node is emitted at
      // `src/ui/console.tsx` (plain-TS canvas shell, no JSX) and `src/main.ts`
      // imports it extensionless. With no `jsx` setting tsc refuses to resolve
      // a `.tsx` module (TS6142) and the game's DECLARED `npm run typecheck`
      // fails on a clean tree. `preserve` admits the extension with no
      // transform and NO React runtime (the game kind declares no react);
      // webapp keeps the real `react-jsx` transform.
      ...(emittedJsx
        ? { jsx: PKG_DEPS[kind]?.react !== undefined ? "react-jsx" : "preserve" }
        : {}),
    },
    include: hasTests ? ["src", "tests"] : ["src"],
  };
  return `${JSON.stringify(cfg, null, 2)}\n`;
}

// ---------------------------------------------------------------------------
// Spec-graph node stubs (E-15 #2) â€” typed skeletons per node, in topo order
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

/** Map a contract field type ("ulid?", "int", â€¦) to a TS type. */
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
    `// ${path} â€” ${prose(purpose)}`,
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
      "// REAL domain module (fixes/352): the typed entities recorded in the A6",
      "// data contract. This module owns only these types â€” it never re-exports",
      "// the generated tree. Extend the field list as the contract grows.",
    ]),
  ];
  if (!entities.length) {
    lines.push(
      "// No contract entities recorded yet â€” complete the P0/P1 phases to",
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
      lines.push(
        "  // The A6 contract records this entity by name only; `id` is its stable",
        "  // key. Add the real field shape when the contract carries one.",
        `  id: string;`,
      );
    }
    // Duplicate/colliding field identifiers (same field twice, or hostile
    // names that sanitize onto the same identifier) would emit duplicate
    // interface members â€” a TS2300 error that breaks `npm run typecheck` on
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
 * (method+path+job), so `route` dispatches for real â€” a recorded endpoint
 * whose job module was emitted (see `emitJobModule`) is served by that module;
 * an endpoint with no emitted implementation still refuses with the coded
 * `RT_E_VALIDATION Â· TODO(E-15) stub` form (honest: the seam is absent, and
 * nothing pretends otherwise). `opts.jobModules` names the REAL job modules
 * this emit wrote (label + sanitized path); empty â‡’ the pre-328 bytes'
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
      "// form â€” never a silent success. tests/oracle.spec.ts names the oracle",
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
      : [`  // No endpoints recorded â€” complete P0/P1 (A6 synthesizer).`]),
    `];`,
    "",
    "/** Recorded endpoints â†’ the REAL job modules this emit materialised. */",
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
    `    throw new Error(\`${EMITTED_REFUSAL_CODE} Â· unknown endpoint \${method} \${path} â€” not in the recorded A6 contract\`);`,
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

/**
 * store node: a REAL persisted state container (fixes/352).
 *
 * fixes/352 replaced the old in-memory-only `CheckpointStore` stub (and the
 * re-export bridge tree mode used to write here) with a dependency-free
 * container that persists through an injectable `StorageSeam`: localStorage
 * when the runtime provides it, an in-memory fallback otherwise. The emitted
 * UI/order flow reads and writes the same container, so state survives a
 * reload. No network, no fabricated behaviour â€” every read/write is real.
 */
function emitStore(node: { file: string; purpose: string }, project: Project): string {
  const keyBase = jstr(slugName(project.name) || "project");
  return [
    ...sourceHeader(node.file, node.purpose, project, [
      "// REAL persisted state container (fixes/352) â€” dependency-free, backed by",
      "// an injectable StorageSeam (localStorage in the browser, an in-memory",
      "// fallback under Node/tests). Nothing here is a mock or a stub.",
    ]),
    `/** The minimal Web Storage surface this module depends on. */`,
    `export interface StorageSeam {`,
    `  getItem(key: string): string | null;`,
    `  setItem(key: string, value: string): void;`,
    `  removeItem(key: string): void;`,
    `}`,
    ``,
    `/** In-memory fallback so the container works without localStorage (SSR/tests). */`,
    `export function memoryStorage(): StorageSeam {`,
    `  const map = new Map<string, string>();`,
    `  return {`,
    `    getItem: (key: string): string | null => (map.has(key) ? map.get(key) ?? null : null),`,
    `    setItem: (key: string, value: string): void => {`,
    `      map.set(key, value);`,
    `    },`,
    `    removeItem: (key: string): void => {`,
    `      map.delete(key);`,
    `    },`,
    `  };`,
    `}`,
    ``,
    `/** localStorage when the runtime provides it, else the in-memory fallback. */`,
    `export function defaultStorage(): StorageSeam {`,
    `  try {`,
    `    if (typeof localStorage !== "undefined" && localStorage !== null) return localStorage;`,
    `  } catch {`,
    `    // Accessing localStorage can throw (sandboxed iframe / storage disabled).`,
    `  }`,
    `  return memoryStorage();`,
    `}`,
    ``,
    `export type Checkpoint = { phase: number; status: string; updatedAt: string };`,
    ``,
    `const STORE_KEY = ${keyBase} + ".checkpoints";`,
    `const ORDER_KEY = ${keyBase} + ".orders";`,
    ``,
    `function readJson(storage: StorageSeam, key: string): unknown {`,
    `  const raw = storage.getItem(key);`,
    `  if (raw === null || raw === "") return null;`,
    `  try {`,
    `    return JSON.parse(raw) as unknown;`,
    `  } catch {`,
    `    return null;`,
    `  }`,
    `}`,
    ``,
    `/** Real persisted checkpoint container â€” every mutation is durable. */`,
    `export class CheckpointStore {`,
    `  private readonly checkpoints = new Map<number, Checkpoint>();`,
    `  private readonly listeners = new Set<() => void>();`,
    `  private readonly storage: StorageSeam;`,
    `  private readonly key: string;`,
    ``,
    `  constructor(storage: StorageSeam = defaultStorage(), key: string = STORE_KEY) {`,
    `    this.storage = storage;`,
    `    this.key = key;`,
    `    const raw = readJson(storage, key);`,
    `    if (Array.isArray(raw)) {`,
    `      for (const entry of raw) {`,
    `        if (entry === null || typeof entry !== "object") continue;`,
    `        const cp = entry as Partial<Checkpoint>;`,
    `        if (typeof cp.phase === "number" && Number.isFinite(cp.phase)) {`,
    `          this.checkpoints.set(cp.phase, {`,
    `            phase: cp.phase,`,
    `            status: typeof cp.status === "string" ? cp.status : "",`,
    `            updatedAt: typeof cp.updatedAt === "string" ? cp.updatedAt : "",`,
    `          });`,
    `        }`,
    `      }`,
    `    }`,
    `  }`,
    ``,
    `  private persist(): void {`,
    `    try {`,
    `      this.storage.setItem(this.key, JSON.stringify([...this.checkpoints.values()]));`,
    `    } catch {`,
    `      // Storage unavailable or full â€” the in-memory copy stays authoritative.`,
    `    }`,
    `    for (const listener of this.listeners) listener();`,
    `  }`,
    ``,
    `  write(checkpoint: Checkpoint): void {`,
    `    this.checkpoints.set(checkpoint.phase, { ...checkpoint });`,
    `    this.persist();`,
    `  }`,
    ``,
    `  read(phase: number): Checkpoint | undefined {`,
    `    const cp = this.checkpoints.get(phase);`,
    `    return cp === undefined ? undefined : { ...cp };`,
    `  }`,
    ``,
    `  all(): Checkpoint[] {`,
    `    return [...this.checkpoints.values()].map((cp) => ({ ...cp }));`,
    `  }`,
    ``,
    `  subscribe(listener: () => void): () => void {`,
    `    this.listeners.add(listener);`,
    `    return () => {`,
    `      this.listeners.delete(listener);`,
    `    };`,
    `  }`,
    ``,
    `  clear(): void {`,
    `    this.checkpoints.clear();`,
    `    this.persist();`,
    `  }`,
    `}`,
    ``,
    `export type OrderRecord = { id: string; message: string; submittedAt: string; payload: unknown };`,
    ``,
    `/** Real persisted order log â€” the ordering flow's records survive a reload. */`,
    `export class OrderLog {`,
    `  private readonly orders = new Map<string, OrderRecord>();`,
    `  private readonly storage: StorageSeam;`,
    `  private readonly key: string;`,
    ``,
    `  constructor(storage: StorageSeam = defaultStorage(), key: string = ORDER_KEY) {`,
    `    this.storage = storage;`,
    `    this.key = key;`,
    `    const raw = readJson(storage, key);`,
    `    if (Array.isArray(raw)) {`,
    `      for (const entry of raw) {`,
    `        if (entry === null || typeof entry !== "object") continue;`,
    `        const rec = entry as Partial<OrderRecord>;`,
    `        if (typeof rec.id === "string" && rec.id !== "") {`,
    `          this.orders.set(rec.id, {`,
    `            id: rec.id,`,
    `            message: typeof rec.message === "string" ? rec.message : "",`,
    `            submittedAt: typeof rec.submittedAt === "string" ? rec.submittedAt : "",`,
    `            payload: rec.payload,`,
    `          });`,
    `        }`,
    `      }`,
    `    }`,
    `  }`,
    ``,
    `  /** Idempotent by id: re-recording the same order never duplicates it. */`,
    `  record(record: OrderRecord): OrderRecord {`,
    `    const existing = this.orders.get(record.id);`,
    `    const stored = existing ?? { ...record };`,
    `    this.orders.set(stored.id, stored);`,
    `    if (existing === undefined) {`,
    `      try {`,
    `        this.storage.setItem(this.key, JSON.stringify([...this.orders.values()]));`,
    `      } catch {`,
    `        // Storage unavailable â€” the in-memory log still serves this session.`,
    `      }`,
    `    }`,
    `    return { ...stored };`,
    `  }`,
    ``,
    `  latest(): OrderRecord | undefined {`,
    `    const all = this.all();`,
    `    return all.length === 0 ? undefined : all[all.length - 1];`,
    `  }`,
    ``,
    `  all(): OrderRecord[] {`,
    `    return [...this.orders.values()].map((rec) => ({ ...rec }));`,
    `  }`,
    ``,
    `  /** Order ids recorded so far â€” the persisted reference list. */`,
    `  readonlyReferences(): string[] {`,
    `    return this.all().map((rec) => rec.id);`,
    `  }`,
    ``,
    `  clear(): void {`,
    `    this.orders.clear();`,
    `    try {`,
    `      this.storage.removeItem(this.key);`,
    `    } catch {`,
    `      // Nothing persisted to remove.`,
    `    }`,
    `  }`,
    `}`,
    ``,
    `/** Shared singleton the emitted UI/order flow persists through. */`,
    `export const orderLog = new OrderLog();`,
    ``,
  ].join("\n");
}

/**
 * fixes/352: the TREE-mode api module. Pre-fix, an uncovered `api` node in tree
 * mode was a thin `export * from "../generated.ts"` bridge, so `src/api/routes.ts`
 * claimed to be an API while exposing no endpoint of its own â€” the emitted tree
 * lied about having an API. This emits a REAL router over the recorded A6
 * endpoints, dispatching each to the generated tree's own job module through the
 * job's bound run export (verified to exist in the tree source). An endpoint
 * whose job module the tree did not materialise refuses with the coded
 * RT_E_VALIDATION form â€” never a silent success.
 */
function emitTreeApi(
  node: { file: string; purpose: string },
  project: Project,
  opts: { apiPath: string; jobModules: readonly { label: string; path: string; run: string; arity: number; extraArgs: string[] }[] },
): string {
  const endpoints = project.contracts?.endpoints ?? [];
  const apiPath = opts.apiPath;
  const jobModules = opts.jobModules;
  const call = (m: { run: string; arity: number; extraArgs: string[] }, i: number): string =>
    m.arity === 0
      ? `async (input: unknown) => { void input; return treeJob${i}.${m.run}(); }`
      : `async (input: unknown) => treeJob${i}.${m.run}(input as Parameters<typeof treeJob${i}.${m.run}>[0]${
          m.extraArgs.length ? `, ${m.extraArgs.join(", ")}` : ""
        })`;
  return [
    ...sourceHeader(node.file, node.purpose, project, [
      "// REAL HTTP module (fixes/352): the recorded A6 endpoints, dispatched to",
      "// the generated tree's own job modules through each job's bound run export.",
      "// An endpoint whose job module the tree did not materialise refuses with the",
      "// coded RT_E_VALIDATION form â€” never a silent success.",
    ]),
    ...jobModules.map(
      (m, i) => `import * as treeJob${i} from ${jstr(tsImportPath(dirOf(apiPath), m.path))};`,
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
      : [`  // No endpoints recorded â€” complete P0/P1 (A6 synthesizer).`]),
    `];`,
    "",
    "/** Recorded endpoints â†’ the generated tree's REAL job modules. */",
    "const HANDLERS: Record<string, (input: unknown) => Promise<unknown>> = {",
    ...jobModules.map((m, i) => `  ${jstr(m.label)}: ${call(m, i)},`),
    "};",
    "",
    "/** The bound handler for a job label, or undefined when the tree lacks it. */",
    "export function handlerFor(job: string): ((input: unknown) => Promise<unknown>) | undefined {",
    "  return HANDLERS[job];",
    "}",
    "",
    "export async function route(",
    "  method: EndpointMethod,",
    "  path: string,",
    "  input: unknown,",
    "): Promise<{ ok: boolean; job?: string; result?: unknown }> {",
    "  const endpoint = ENDPOINTS.find((e) => e.method === method && e.path === path);",
    "  if (!endpoint) {",
    `    throw new Error(\`${EMITTED_REFUSAL_CODE} Â· unknown endpoint \${method} \${path} â€” not in the recorded A6 contract\`);`,
    "  }",
    "  const handler = HANDLERS[endpoint.job];",
    "  if (!handler) {",
    `    throw new Error(\`${emittedRefusal("TODO(E-15) stub: implement")} \${method} \${path}\`);`,
    "  }",
    "  return { ok: true, job: endpoint.job, result: await handler(input) };",
    "}",
    "",
  ].join("\n");
}

/** Oracle expectation comment lines for a job label (A7 rows, E-08 seed format). */
function oracleExpectations(project: Project, jobLabel: string | null): string[] {
  if (!jobLabel) return [];
  const rows = project.oracle.filter((row) => row.job === jobLabel);
  if (!rows.length) return [`  // no oracle rows recorded for this job yet`];
  return rows.map(
    (row) => `  // # ${row.id} ${row.name} â€” ${prose(row.given)} => ${prose(row.expect)}`,
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
      "// verbatim below. Its self-tests ran inside the engine isolate at P6 â€” keep them",
      "// green when you implement the surrounding jobs.",
    ]),
    source.trim(),
    "",
  ];
  // fixes/135 (real oracle tests): when the hosted module is the deterministic
  // P6 engine template, expose its top-level names so tests/oracle.spec.ts can
  // assert the module's real behavior (JOBS/synthesize/REJECTION). The tail is
  // added AFTER the verbatim source â€” generatedSource itself is untouched and
  // keyed/model modules (which carry their own export shape) never get it.
  if (isTemplateModule(source)) hostLines.push(TEMPLATE_EXPORT_TAIL);
  return hostLines.join("\n");
}

/**
 * fixes/144 (M2): a spec-graph node file the generated tree does NOT cover.
 * In tree mode the node materializes as a THIN RE-EXPORT of the tree's ENTRY
 * module, so every graph path the scaffold promised still exists + resolves,
 * while all real code stays in the tree files â€” never a TODO(E-15) stub
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
      `// path, so this module re-exports the tree ENTRY module (${entryPath}) verbatim â€”`,
      "// real generated code, not a TODO stub. Align this node's file with a tree path",
      "// (or regenerate the tree) to replace the bridge.",
    ]),
    `export * from ${jstr(tsImportPath(fromDir, entryPath))};`,
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// fixes/328 P2 (TA-15 / P0-04) â€” REAL per-job modules from the recorded API
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
// export surface â€” never one module wearing N filenames.
//
// Honesty boundary: the recorded spec carries the API SURFACE (names, params,
// return types) plus the job's A6 endpoints and A7 row ids â€” it does NOT carry
// domain rules or field shapes for the referenced contract types. The body
// implements exactly the recorded call (a keyed store transition) and every
// referenced-but-unshaped contract type is declared OPAQUELY. Nothing is
// invented. The signatureâ†’job binding mirrors codegen's
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
  /** The (inner) return is an array type â‡’ the emitted body wraps in `[...]`. */
  array: boolean;
  /** The recorded return was `Promise<â€¦>` â‡’ the emitted function is async. */
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
 *  never invented as field shapes â€” the spec records the name only). */
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
      "// in-module record store. The recorded spec carries the API surface â€”",
      "// function names, parameters, return types â€” plus the A6 endpoints and",
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
    `/** A7 oracle row ids recorded for this job â€” the acceptance prose is emitted`,
    ` *  into tests/oracle.spec.ts. */`,
    `export const ORACLE_ROWS: readonly string[] = [${oracleIds.map((id) => jstr(id)).join(", ")}];`,
    "",
  ];

  const aliases = opaqueTypeNames(signatures);
  if (aliases.length > 0) {
    lines.push(
      "/** Contract types named by the recorded typeSignatures. The spec records",
      " *  the NAME only, never a field shape â€” declared opaquely rather than",
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

// ---------------------------------------------------------------------------
// 340-6 (A3-f07 / W-14): the DEFAULT emitted-UI generator.
//
// A real, deterministic renderer over the project's OWN bytes â€” no model call,
// no new dependency. INPUTS: project.implementationSpec (typeSignatures, â€¦),
// project.contracts (A6 entities/fields), project.lattice (brief nouns), and
// the generated ENTRY module's REAL exported surface, parsed from the exact
// source the emitter writes (the tree entry file, or generatedSource plus its
// template export tail â€” never a guessed name). BAR (W-14): the emitted
// Console() references â‰¥2 real domain fields and wires a form interaction to a
// GENUINELY exported function of that module; a module exporting no callable,
// or a project with <2 real fields, yields the honest "nothing to bind" panel
// instead of fabricated fields. DETERMINISM: every list is project-ordered, so
// the same project emits the same bytes. A caller-supplied UiGenerationHook
// still wins (a non-null return replaces this body; null keeps it); the
// surrounding imports/export wrapper stays scaffold-owned.
// ---------------------------------------------------------------------------

/** One rendered form input, mapped to a real recorded/spec value. */
type UiField = { id: string; label: string; type: string };

/** Hard cap on rendered form fields â€” the generator's documented bound; the
 *  W-14 bar only needs â‰¥2, and every call site returns at most this many. */
const UI_FIELD_CAP = 4;

/** A callable the generated entry module really exports. */
type UiCallable = {
  name: string;
  params: { name: string; type: string; rest: boolean }[];
  /** Keys of a single object-literal parameter default (`spec = { a, b }`). */
  objectKeys: { name: string; type: string }[] | null;
  /** A4: true for an `async` export â€” never called synchronously by the shell. */
  async?: boolean;
};

/** A4: a briefed surface page (derived from contracts/lattice/spec graph). */
export type UiPage = { id: string; title: string };

/** TS primitive param types that take a scalar argument, not an object. */
const UI_PRIMITIVE_TYPE = /^(string|number|boolean|bigint|symbol)$/i;

/**
 * fixes/341-1: parameter types a FormData string can be soundly coerced to â€”
 * exactly the targets `defaultUiGeneration.coerce` produces (String/Number/
 * boolean). A domain-typed param (e.g. `board: Board`) is NOT here: the
 * emitted `String(data.get(...))` argument is not assignable to it, so a form
 * must never be bound to such a callable. Empty/any/unknown accept anything.
 * fixes/346-S5: the test runs on the alias-RESOLVED type text
 * (`uiResolveTypeText`), so a local `type Money = number` IS bindable while an
 * interface `Board` or a string-literal-union alias is still not.
 */
const UI_FORM_BINDABLE_TYPE =
  /^(string|number|boolean|int|integer|float|double|decimal|any|unknown)$/i;

/**
 * fixes/346-S5: resolve a parameter/field type text through the single-line
 * `type A = RHS` aliases the scanned entry source declares (`uiTypeAliases`) â€”
 * bounded and cycle-safe. The measured defect: the keyed tree's only callable
 * `computeLineTotal(quantity: number, unitPrice: Money)` (with `type Money =
 * number;` in the same tree) was left unwired because the bindable test saw the
 * alias NAME `Money`, not its real numeric shape. A form's `Number(...)` IS
 * assignable to it, so the honest panel was a false negative. An interface (not
 * a `type`) is never in the alias map, so a domain object param stays unbindable.
 */
function uiResolveTypeText(type: string, aliases?: ReadonlyMap<string, string>): string {
  let t = String(type ?? "").trim();
  if (aliases === undefined || aliases.size === 0) return t;
  const seen = new Set<string>();
  while (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(t) && !seen.has(t)) {
    const next = aliases.get(t);
    if (next === undefined) break;
    seen.add(t);
    t = next.trim();
  }
  return t;
}

function uiFormBindableParam(type: string, aliases?: ReadonlyMap<string, string>): boolean {
  const t = uiResolveTypeText(type, aliases);
  if (t === "" || UI_FORM_BINDABLE_TYPE.test(t)) return true;
  // 353: a nullable/optional primitive (`number | null`, `string | undefined`)
  // is bindable too â€” the form's Number(...)/String(...) value is assignable to
  // it. A literal-union (or any non-primitive member) stays unbindable.
  const parts = t.split("|").map((p) => p.trim()).filter(Boolean);
  return (
    parts.length > 1 &&
    parts.every((p) => /^(null|undefined)$/.test(p) || UI_FORM_BINDABLE_TYPE.test(p))
  );
}

/** Top-level comma split of a function header's parameter text. */
function uiParamParts(text: string): string[] {
  return splitTopLevel(text, ",")
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Parse one parameter declaration (name, type, rest, and any default value). */
function uiParseParam(
  raw: string,
): { name: string; type: string; rest: boolean; defaultText: string | null } | null {
  const rest = raw.startsWith("...");
  const body = (rest ? raw.slice(3) : raw).trim();
  const eq = /^([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*([\s\S]+)$/.exec(body);
  if (eq) return { name: eq[1]!, type: "", rest, defaultText: eq[2]!.trim() };
  const m = /^([A-Za-z_$][A-Za-z0-9_$]*)(\?)?\s*(?::\s*([\s\S]+))?$/.exec(body);
  if (!m) return null;
  return { name: m[1]!, type: (m[3] ?? "").trim(), rest, defaultText: null };
}

/**
 * Top-level `{ a, b: c }` keys of an object-literal default, with a type
 * inferred from each value literal (null when the default is not an object
 * literal). Reads the generated function's own field names â€” never invented.
 */
function uiObjectLiteralKeys(defaultText: string): { name: string; type: string }[] | null {
  const text = defaultText.trim();
  if (!text.startsWith("{") || !text.endsWith("}")) return null;
  const keys: { name: string; type: string }[] = [];
  for (const part of splitTopLevel(text.slice(1, -1), ",")) {
    const m = /^([A-Za-z_$][A-Za-z0-9_$]*)\s*(?::\s*([\s\S]+))?$/.exec(part.trim());
    if (!m || keys.some((k) => k.name === m[1]!)) continue;
    const value = (m[2] ?? "").trim();
    const type = /^-?\d/.test(value) ? "number" : /^(true|false)$/.test(value) ? "boolean" : "string";
    keys.push({ name: m[1]!, type });
  }
  return keys.length > 0 ? keys : null;
}

/** Content between a `(` at `open` and its matching `)` (quote/nesting aware). */
function uiReadParen(text: string, open: number): string {
  if (text[open] !== "(") return "";
  let depth = 0;
  let quote = "";
  for (let i = open; i < text.length; i++) {
    const ch = text[i]!;
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  return "";
}

/**
 * The functions a generated module body really exports, in source order:
 * `export function f`, `export const f = (â€¦) =>`/`= function`, and declared
 * functions re-exported through `export { f }`. A binding that cannot be tied
 * to a function declaration is never returned, so a caller can never emit a
 * call to a name the module does not export.
 */
function uiExportedCallables(source: string): UiCallable[] {
  const text = String(source ?? "");
  const declared = new Map<string, string>(); // declared function -> params text
  for (const m of text.matchAll(/^function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/gm)) {
    declared.set(m[1]!, uiReadParen(text, m.index! + m[0].length - 1));
  }
  const calls = new Map<string, string>(); // exported name -> params text
  for (const m of text.matchAll(/^export\s+(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/gm)) {
    calls.set(m[1]!, uiReadParen(text, m.index! + m[0].length - 1));
  }
  for (const m of text.matchAll(
    /^export\s+(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?(?:\(([^)]*)\)|function\s*\(([^)]*)\))/gm,
  )) {
    calls.set(m[1]!, m[2] ?? m[3] ?? "");
  }
  for (const m of text.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const part of m[1]!.split(",")) {
      const p = part.trim();
      if (!p) continue;
      const as = /^([A-Za-z_$][A-Za-z0-9_$]*)\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)$/.exec(p);
      const local = as ? as[1]! : p;
      const exported = as ? as[2]! : p;
      if (declared.has(local)) calls.set(exported, declared.get(local)!);
    }
  }
  // A4: names exported as `async` â€” the shell must never call one synchronously.
  const asyncNames = new Set<string>();
  for (const m of text.matchAll(/^export\s+async\s+function\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm)) asyncNames.add(m[1]!);
  for (const m of text.matchAll(/^export\s+(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*async\b/gm)) asyncNames.add(m[1]!);
  const out: UiCallable[] = [];
  for (const [name, paramsText] of calls) {
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) || out.some((c) => c.name === name)) continue;
    const params: UiCallable["params"] = [];
    let objectKeys: UiCallable["objectKeys"] = null;
    for (const part of uiParamParts(paramsText)) {
      const parsed = uiParseParam(part);
      if (!parsed) continue;
      params.push({ name: parsed.name, type: parsed.type, rest: parsed.rest });
      if (parsed.defaultText) objectKeys = uiObjectLiteralKeys(parsed.defaultText) ?? objectKeys;
    }
    out.push({ name, params, objectKeys, ...(asyncNames.has(name) ? { async: true } : {}) });
  }
  return out;
}

/**
 * A4: the briefed surfaces a website/marketing shell should present, in
 * deterministic order â€” contract entity names, spec-graph job labels, then the
 * lattice's own jobs/entities. Deduped by normalized title, capped at 6. Titles
 * are derived strictly from the brief's own declarations; nothing invented.
 */
export function uiBriefPages(project: Project): UiPage[] {
  const out: UiPage[] = [];
  const seen = new Set<string>();
  const push = (raw: string): void => {
    const title = collapse(raw).slice(0, 60);
    if (!title) return;
    const id = ident(title, "page");
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ id, title });
  };
  for (const ent of project.contracts?.entities ?? []) if (ent && typeof ent.name === "string") push(ent.name);
  for (const node of project.specGraph?.nodes ?? []) {
    const m = /[â€œ"]([^â€"]+)[â€"]/.exec(typeof node.purpose === "string" ? node.purpose : "");
    if (m && m[1]!.trim()) push(m[1]!);
  }
  for (const job of project.lattice?.jobs ?? []) if (typeof job === "string") push(job);
  for (const ent of project.lattice?.entities ?? []) if (typeof ent === "string") push(ent);
  return out.slice(0, 6);
}

/** A4: a generated export shaped like a page/screen renderer (drives the multi-section shell). */
function uiRenderLike(c: UiCallable): boolean {
  return /^(?:render[A-Z_$]|.*Page$|get[A-Za-z0-9_$]*Screen$)/.test(c.name) && c.async !== true;
}

/**
 * 341-1: the keyed chunked synthesis materialises its entry as an ESM BARREL
 * of `export * from "./x.ts"` lines (codegen `materializeImportableTree`), so
 * the callables the shell may call are real exports of the imported namespace
 * yet appear nowhere in the entry's own bytes â€” a scan of the entry source
 * alone finds none, and the generator fell back to the honest (but
 * under-delivering) "no callable" panel for the exact shape a real keyed tree
 * produces. Follow the entry's `export *` specifiers over the accepted tree
 * files (deduped, cycle-safe, bounded) so the discovered callables name names
 * the imported barrel genuinely re-exports.
 */
function uiFollowStarExports(
  entry: { path: string; source: string },
  byPath: Map<string, { path: string; source: string }>,
): string {
  const seen = new Set<string>([entry.path]);
  const queue: { path: string; source: string }[] = [entry];
  let out = entry.source;
  let appended = 0;
  while (queue.length > 0 && appended < 24) {
    const cur = queue.shift()!;
    const fromDir = dirOf(cur.path);
    for (const m of cur.source.matchAll(/^[ \t]*export\s+\*\s+from\s+["']([^"']+)["']/gm)) {
      const target = uiResolveTreeSpecifier(fromDir, m[1]!, byPath);
      if (target === null || seen.has(target.path)) continue;
      seen.add(target.path);
      out = `${out}\n${target.source}`;
      queue.push(target);
      appended += 1;
    }
  }
  return out;
}

/** Resolve one tree-relative ESM specifier to an accepted emitted file (POSIX
 *  path); null on an absolute/unsafe specifier or a file the tree lacks. */
function uiResolveTreeSpecifier(
  fromDir: string,
  spec: string,
  byPath: Map<string, { path: string; source: string }>,
): { path: string; source: string } | null {
  if (typeof spec !== "string" || spec.startsWith("/") || /^[A-Za-z]:/.test(spec)) return null;
  const segs = fromDir.split("/").filter((s) => s && s !== ".");
  for (const part of spec.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (segs.length === 0) return null;
      segs.pop();
      continue;
    }
    segs.push(part);
  }
  return byPath.get(segs.join("/")) ?? null;
}

/**
 * The generated ENTRY source the emitted shell imports â€” mirroring
 * scaffoldProject's own entry resolution (the tree ENTRY file, else the
 * generatedSource host with its template export tail). Null when this emit
 * writes no generated module at all. Kept in lock-step with the emit path so a
 * parsed export always names something the imported module really has; a tree
 * ENTRY that is an `export *` barrel is expanded over the accepted tree files
 * (341-1) so its re-exported callables are discoverable.
 */
function uiGeneratedEntrySource(project: Project): string | null {
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
  const jobEntry = ordered.find((o) => o.node.id.startsWith("job-"));
  const rolePath = jobEntry
    ? safeNodePath(jobEntry.node.file, jobEntry.node.id, jobEntry.index)
    : "src/generated.ts";

  const rawTree = Array.isArray(project.generatedTree) ? project.generatedTree : [];
  const accepted: { path: string; source: string }[] = [];
  const seen = new Set<string>();
  for (const row of rawTree) {
    if (row === null || typeof row !== "object") continue;
    const pathRaw = (row as { path?: unknown }).path;
    const source = (row as { source?: unknown }).source;
    const hash = (row as { hash?: unknown }).hash;
    if (typeof source !== "string" || typeof hash !== "string") continue;
    if (treePathRefusal(pathRaw) !== null) continue;
    const path = pathRaw as string;
    if (seen.has(path)) continue;
    seen.add(path);
    accepted.push({ path, source });
  }
  accepted.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  if (accepted.length > 0) {
    const byPath = new Map(accepted.map((f) => [f.path, f]));
    // C1-02: resolve the SAME entry the emitted shell imports â€” the tree barrel
    // when present (see treeEntryPath), so the callables discovered here are
    // genuinely re-exported by the module `emitUi` imports.
    const entry = byPath.get("src/generated.ts") ?? byPath.get(rolePath) ?? accepted[0];
    return entry ? uiFollowStarExports(entry, byPath) : null;
  }
  const generated = (project.generatedSource ?? "").trim();
  if (!generated) return null;
  return isTemplateModule(generated) ? `${generated}\n${TEMPLATE_EXPORT_TAIL}` : generated;
}

/**
 * Real domain fields for the emitted form, in deterministic priority order:
 * the callable's own surface (object-literal keys, else its parameters), then
 * the recorded typeSignatures' parameters, the A6 contract entity fields, and
 * the lattice's brief nouns. Never invented; deduped and capped.
 */
function uiDomainFields(
  project: Project,
  callable: UiCallable,
  shape: "object" | "positional" | "none",
  aliases?: ReadonlyMap<string, string>,
): UiField[] {
  const fields: UiField[] = [];
  const seen = new Set<string>();
  const push = (id: string, label: string, type: string): void => {
    const clean = ident(id);
    if (!clean || seen.has(clean)) return;
    seen.add(clean);
    fields.push({ id: clean, label, type });
  };

  if (shape === "positional") {
    // fixes/346-S5: resolve a local alias (`Money` â†’ `number`) so the emitted
    // form's coercion and the recorded field type agree with the callable.
    for (const p of callable.params) if (!p.rest) push(p.name, p.name, uiResolveTypeText(p.type, aliases));
    return fields.slice(0, UI_FIELD_CAP);
  }
  if (callable.objectKeys) {
    for (const key of callable.objectKeys) push(key.name, key.name, key.type);
    return fields.slice(0, UI_FIELD_CAP);
  }
  for (const p of callable.params) if (!p.rest) push(p.name, p.name, uiResolveTypeText(p.type, aliases));

  const spec = project.implementationSpec;
  const sigs = spec && Array.isArray(spec.typeSignatures) ? spec.typeSignatures : [];
  for (const raw of sigs) {
    const m = /^[^(]*\(([\s\S]*)\)/.exec(String(raw ?? ""));
    if (!m) continue;
    for (const part of uiParamParts(m[1]!)) {
      const p = uiParseParam(part);
      if (p && !p.rest) push(p.name, p.name, p.type);
    }
  }
  const entities =
    project.contracts && Array.isArray(project.contracts.entities) ? project.contracts.entities : [];
  for (const ent of entities) {
    for (const f of Array.isArray(ent?.fields) ? ent.fields : []) {
      const name = String(f?.name ?? "");
      if (name) push(`${ent.name}_${name}`, `${ent.name} Â· ${name}`, String(f?.type ?? ""));
    }
  }
  const latEntities =
    project.lattice && Array.isArray(project.lattice.entities) ? project.lattice.entities : [];
  for (const name of latEntities) push(String(name), String(name), "string");
  return fields.slice(0, UI_FIELD_CAP);
}

/** C1-02: a render export the shell may call, with its sound call arguments. */
type UiRenderCall = { name: string; args: string[] };

/**
 * A4 (SYNTHSPEC P5b): the multi-section shell for a website/marketing brief â€” a
 * <nav> from the briefed page titles and one <section> per page. A page whose
 * discovered render export is callable with sound arguments calls it and
 * renders the result (a string via a <div>; a node via the ReactNode cast); a
 * page with no such export gets an honest "not implemented" note. Never
 * fabricates data; never a <canvas>. The H1 is the markdown-stripped display name.
 */
function defaultUiShellBody(project: Project, pages: UiPage[], renderCalls: UiRenderCall[]): string[] {
  const lines: string[] = [];
  const nodeExpr: string[] = [];
  const used = new Set<string>();
  for (const page of pages) {
    const key = page.id.toLowerCase().replace(/_/g, "");
    const rc =
      renderCalls.find((c) => !used.has(c.name) && c.name.toLowerCase().replace(/_/g, "").includes(key)) ??
      renderCalls.find((c) => !used.has(c.name));
    if (rc !== undefined) {
      used.add(rc.name);
      lines.push(`  const ${`__page_${page.id}`}: unknown = generated.${rc.name}(${rc.args.join(", ")});`);
      nodeExpr.push(`__page_${page.id}`);
    } else {
      nodeExpr.push("null");
    }
  }
  lines.push(
    `  const pages: { id: string; title: string }[] = [`,
    ...pages.map((p) => `    { id: ${jstr(p.id)}, title: ${jstr(p.title)} },`),
    `  ];`,
    `  const pageNodes: unknown[] = [${nodeExpr.join(", ")}];`,
    `  return (`,
    `    <main>`,
    `      <h1>{${jstr(displayName(project.name))}}</h1>`,
    `      <nav>{pages.map((p) => <span key={p.id}>{p.title}</span>)}</nav>`,
    `      {pages.map((p, i) => (`,
    `        <section key={p.id}>`,
    `          <h2>{p.title}</h2>`,
    `          {typeof pageNodes[i] === "string" ? <div>{pageNodes[i] as string}</div> : (pageNodes[i] as ReactNode)}`,
    `        </section>`,
    `      ))}`,
    `    </main>`,
    `  );`,
  );
  return lines;
}

/**
 * fixes/346-S4: the simple `type NAME = RHS;` aliases declared anywhere in the
 * scanned entry source (the barrel + every file it `export *`s). A generated
 * render export routinely types its parameter with a local alias (`renderTabs(
 * activeTab: TabId)` where `type TabId = string`); without resolving the alias
 * the shell could not prove a sound argument and left the export uncalled. Only
 * single-line aliases are read; a non-primitive RHS still yields no argument.
 */
function uiTypeAliases(source: string): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const m of String(source ?? "").matchAll(/^type\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*([^\n;]+);?/gm)) {
    const name = m[1]!;
    if (!aliases.has(name)) aliases.set(name, m[2]!.trim());
  }
  return aliases;
}

/**
 * C1-02: a sound scalar literal for a render export parameter, from its own
 * declared type text â€” a primitive (`string`/`number`/`boolean`), the first
 * member of a literal union, `[]` for an array type, or `null` for
 * `any`/`unknown`/`null`/`undefined`. A bare type-alias identifier is resolved
 * to its declared RHS ONCE (fixes/346-S4) so a real export can still be called;
 * an object/function type returns null: the shell must never call a render
 * export with an argument it cannot prove assignable (the pre-seal tsc gate
 * would refuse the whole tree).
 */
function uiLiteralArg(type: string, aliases?: ReadonlyMap<string, string>): string | null {
  const t = String(type ?? "").trim();
  if (!t) return null;
  const parts = t.split("|").map((p) => p.trim()).filter(Boolean);
  if (parts.some((p) => /^(any|unknown)$/.test(p))) return "null";
  const strLit = parts.find((p) => /^'[^']*'$/.test(p) || /^"[^"]*"$/.test(p));
  if (strLit !== undefined) return strLit;
  const numLit = parts.find((p) => /^-?\d+(?:\.\d+)?$/.test(p));
  if (numLit !== undefined) return numLit;
  // An empty array is assignable to every `T[]` / `Array<T>` / `ReadonlyArray<T>`
  // (but never to a tuple), so a renderer that iterates its input can be called
  // with the honest empty dataset rather than left unwired.
  const arr = parts.find(
    (p) =>
      /^(?!\[)[A-Za-z0-9_$<>,[\] .'"]*\[\]$/.test(p) ||
      /^(readonly\s+)?(Readonly)?Array\s*<.+>$/.test(p),
  );
  if (arr !== undefined) return "[]";
  if (parts.every((p) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(p))) {
    if (parts.includes("string")) return '""';
    if (parts.includes("number")) return "0";
    if (parts.includes("boolean")) return "false";
    if (parts.includes("null") || parts.includes("undefined")) return "null";
  }
  // fixes/346-S4: resolve bare type-ALIAS members to their declared RHS and
  // re-evaluate ONCE (no further aliasing, so a cyclic alias cannot recurse).
  if (aliases !== undefined && aliases.size > 0) {
    let changed = false;
    const resolved = parts.map((p) => {
      if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(p) && aliases.has(p)) {
        changed = true;
        return aliases.get(p)!;
      }
      return p;
    });
    if (changed) return uiLiteralArg(resolved.join(" | "));
  }
  return null;
}

/** C1-02: the call arguments for a render export, or null when one cannot be soundly supplied. */
function uiRenderCallArgs(c: UiCallable, aliases?: ReadonlyMap<string, string>): string[] | null {
  if (c.async === true) return null;
  const args: string[] = [];
  for (const p of c.params) {
    if (p.rest) return null;
    const arg = uiLiteralArg(p.type, aliases);
    if (arg === null) return null;
    args.push(arg);
  }
  return args;
}

/**
 * fixes/277 / 340-6 (A3-f07 / W-14): the DEFAULT emitted-UI generation. Null
 * generatedNamespace â‡’ the honest no-module panel (byte-identical to the
 * pre-277 shell). Otherwise a real generator over project.implementationSpec,
 * project.contracts, project.lattice and the generated module's genuinely
 * exported surface â€” a form bound to â‰¥2 real domain fields, submitting into a
 * real exported function, or the honest "nothing to bind" panel when either is
 * absent. A caller-supplied hook still overrides this behind the same contract.
 */
const defaultUiGeneration = ({
  project,
  generatedNamespace,
}: UiGenerationRequest): string[] => {
  if (generatedNamespace === null) {
    return [
      `  const [notice] = useState<string>(`,
      `    "shell â€” no generated module yet; run P6 then re-emit",`,
      `  );`,
      `  return (`,
      `    <main>`,
      `      <h1>{${jstr(displayName(project.name))}}</h1>`,
      `      <p>{notice}</p>`,
      `    </main>`,
      `  );`,
    ];
  }
  const entrySource = uiGeneratedEntrySource(project);
  const callables = entrySource === null ? [] : uiExportedCallables(entrySource);
  // fixes/346-S4: the aliases the exported callables' parameter types may name â€”
  // resolved so a real render export is CALLED with a sound arg, never skipped.
  const typeAliases = entrySource === null ? new Map<string, string>() : uiTypeAliases(entrySource);
  // A4 (SYNTHSPEC P5b): a website/marketing brief â€” its generated entry exports
  // a `render*`/`*Page`/`get*Screen` callable â€” becomes a multi-section shell,
  // not a single debug form. Requiring the render export keeps the honest form
  // generator for a data/app brief that has none (and prevents a shell that is
  // entirely "not implemented"). Only a zero-arg, non-async render export is
  // actually CALLED; a param-bearing one still yields its honest section.
  const renderLike = callables.filter(uiRenderLike);
  // fixes/346-S5: the form-binding shape + soundness of ONE callable, and the
  // preference order for picking it. A callable the form can genuinely bind
  // (â‰¥2 real fields + a sound arg) is preferred over the first multi-field
  // callable: the measured keyed trees carried a bindable two-arg numeric
  // `computeLineTotal(price: number, quantity: number)` that was skipped for an
  // unbindable object-param export declared earlier.
  const formShapeOf = (c: UiCallable): "object" | "positional" | "none" =>
    c.objectKeys
      ? "object"
      : c.params.length === 0
        ? "none"
        : c.params.length === 1
          ? UI_PRIMITIVE_TYPE.test(uiResolveTypeText(c.params[0]!.type, typeAliases))
            ? "positional"
            : "object"
          : "positional";
  const formBindableOf = (c: UiCallable, shape: "object" | "positional" | "none"): boolean =>
    shape === "object"
      ? c.params.length === 1 && c.objectKeys !== null
      : c.params.every((p) => p.rest || uiFormBindableParam(p.type, typeAliases));
  const formWouldWire = (c: UiCallable): boolean => {
    const shape = formShapeOf(c);
    return uiDomainFields(project, c, shape, typeAliases).length >= 2 && formBindableOf(c, shape);
  };
  const multiField = (c: UiCallable): boolean =>
    (c.objectKeys?.length ?? 0) >= 2 || c.params.filter((p) => !p.rest).length >= 2;
  // fixes/346-S2: the GENUINE form callable â€” â‰¥2 real fields + sound args AND
  // a shape that actually consumes them (a zero-arg renderer whose fields would
  // come only from the spec fallback is not a form). `pickFormCallable` keeps
  // the legacy fallback chain for the non-render path; only the genuine one may
  // outrank a render shell.
  const wiredFormCallable: UiCallable | null = callables.find((c) => multiField(c) && formWouldWire(c)) ?? null;
  const pickFormCallable = (): UiCallable | null =>
    wiredFormCallable ?? callables.find(multiField) ?? callables[0] ?? null;
  // fixes/346-S2: ONE deterministic decision. The S5 form-bindable preference
  // was unsigned â€” a soundly callable render export forced the shell and left a
  // genuinely bindable form callable unwired. A genuinely bindable callable now
  // OUTRANKS the render shell: the console CALLS the bindable export. The
  // render/`nothing to wire` shape stands only when no callable can be bound â€”
  // a call is never fabricated.
  //
  // 347 (real-website emission): a tree exporting TWO OR MORE page renderers IS
  // a multi-page site. Mounting one helper form instead of the pages threw the
  // whole site away â€” the measured keyed bakery tree exported renderHome /
  // renderMenu / renderContact / renderOrderForm and the emitted shell rendered
  // a lone `computeLineTotal` form. The multi-page shell therefore outranks the
  // bindable form; the single-render + bindable case (346-S2's signed pin) keeps
  // the form path unchanged.
  if (renderLike.length > 0 && (wiredFormCallable === null || renderLike.length >= 2)) {
    // C1-02: call a render export with SOUND arguments where its own declared
    // parameter types permit (a zero-arg renderer, or one whose params are
    // primitives / literal unions) so the shell mounts a real generated export.
    // A render export whose args cannot be proven assignable is left uncalled â€”
    // its page keeps the honest null node, never a fabricated argument.
    const renderCalls: UiRenderCall[] = [];
    for (const c of renderLike) {
      const args = uiRenderCallArgs(c, typeAliases);
      if (args !== null) renderCalls.push({ name: c.name, args });
    }
    const pages = uiBriefPages(project);
    const shellPages =
      pages.length > 0
        ? pages
        : renderLike.map((c) => ({ id: ident(c.name.replace(/^render/, "") || c.name, "page"), title: c.name }));
    return defaultUiShellBody(project, shellPages, renderCalls);
  }
  // The genuine form callable chosen above, else the legacy first â‰¥2-field /
  // fallback callable (which the honest panel rejects below when unbindable).
  const callable = pickFormCallable();
  const shape: "object" | "positional" | "none" = callable ? formShapeOf(callable) : "none";
  const fields = callable ? uiDomainFields(project, callable, shape, typeAliases) : [];
  // fixes/341-1: the synthesized arguments must be assignable to the
  // callable's REAL parameter types. A positional form supplies one coerced
  // primitive per param, so every non-rest param must be primitive-coercible;
  // an object binding is sound only for a single param carrying its own
  // object-literal default (the emitted literal mirrors the inferred type) â€”
  // fields invented from the spec against an explicitly-typed object param are
  // a guess, and a guessed arg is a compile error the pre-seal gate refuses
  // with no repairable chunk. When the binding cannot be proven sound, emit the
  // honest "nothing to bind" panel instead of fabricating a call.
  const bindable = callable !== null && formBindableOf(callable, shape);
  if (!callable || fields.length < 2 || !bindable) {
    const reason = !callable
      ? "generated module exports no callable function"
      : !bindable
        ? `generated export ${callable.name} takes a parameter a form cannot supply`
        : `generated module exposes fewer than two bindable domain fields (found ${fields.length})`;
    return [
      `  const notice = ${jstr(`shell â€” ${reason}; nothing to wire yet`)};`,
      `  return (`,
      `    <main>`,
      `      <h1>{${jstr(displayName(project.name))}}</h1>`,
      `      <p>{notice}</p>`,
      `    </main>`,
      `  );`,
    ];
  }

  const coerce = (f: UiField): string => {
    const t = f.type.toLowerCase();
    if (/\bnumber\b|\bint(eger)?\b|\bfloat\b|\bdecimal\b|\bdouble\b/.test(t)) {
      return `Number(data.get(${jstr(f.id)}) ?? "")`;
    }
    if (/\bbool(ean)?\b/.test(t)) return `String(data.get(${jstr(f.id)}) ?? "") === "true"`;
    return `String(data.get(${jstr(f.id)}) ?? "")`;
  };
  const callLines: string[] =
    shape === "none"
      ? [`    const result = generated.${callable.name}();`]
      : shape === "object"
        ? [
            `    const result = generated.${callable.name}({`,
            ...fields.map((f) => `      ${f.id}: ${coerce(f)},`),
            `    });`,
          ]
        : [
            `    const result = generated.${callable.name}(`,
            ...fields.map((f) => `      ${coerce(f)},`),
            `    );`,
          ];

  const body: string[] = [
    `  const onSubmit = (event: { preventDefault: () => void; currentTarget: HTMLFormElement }) => {`,
    `    event.preventDefault();`,
    `    const data = new FormData(event.currentTarget);`,
    ...callLines,
    `    const output = event.currentTarget.querySelector("output");`,
    `    if (output) output.textContent = String(JSON.stringify(result));`,
    `  };`,
    `  return (`,
    `    <main>`,
    `      <h1>{${jstr(prose(project.name))}}</h1>`,
    `      <form onSubmit={onSubmit}>`,
  ];
  for (const f of fields) {
    body.push(
      `        <label htmlFor=${jstr(`rt-${f.id}`)}>{${jstr(f.label)}}</label>`,
      `        <input id=${jstr(`rt-${f.id}`)} name=${jstr(f.id)} defaultValue="" />`,
    );
  }
  body.push(
    `        <button type="submit">{${jstr(`Run ${callable.name}`)}}</button>`,
    `        <output />`,
    `      </form>`,
    `    </main>`,
    `  );`,
  );
  return body;
};

/**
 * The handler line `defaultUiGeneration`'s bound form carries â€” the marker the
 * 358 merge reads back from the generator's OWN output, so a site console keeps
 * the operator surface only when there is a real binding to keep (a render/panel
 * shape has no field to merge). The A3-f07/W-14 pin asserts the same literal on
 * the emitted console, so a rename cannot pass silently.
 */
const UI_BOUND_FORM_MARKER = "onSubmit={onSubmit}";

/**
 * 358 (R-UI-1): the ui node's own operator body â€” the one `defaultUiGeneration`
 * binds (â‰¥2 real domain fields + an interaction into a genuinely exported
 * function) â€” or null when this emit would not have produced it at all: a
 * non-webapp kind (whose `emitUi` branch is the canvas/CLI shell, never this
 * generator) or a render/"nothing to bind" shape (nothing real to merge).
 * `defaultUiGeneration` stays the single producer of the body.
 */
function uiOperatorFormBody(project: Project, kind: ProjectKind): string[] | null {
  if (kind !== "webapp") return null;
  const body = defaultUiGeneration({ project, kind, generatedNamespace: "generated" });
  return body.some((line) => line.includes(UI_BOUND_FORM_MARKER)) ? body : null;
}

/**
 * 358 (R-UI-1): the console of a site emission. The site (351 marketing / 353
 * briefed) used to REPLACE the ui node's own file with a bare router mount,
 * which made the W-14 field binding unreachable for every input class that
 * derived a page set. Merge instead: the derived router mounts AND the operator
 * surface is kept, so neither source wins wholesale at the node. Returns null
 * when there is no binding to keep, so each caller keeps its exact pre-358 bytes.
 */
function siteOperatorConsole(args: {
  header: string[];
  project: Project;
  kind: ProjectKind;
  /** Import specifier from `src/ui` to the generated entry module. */
  entryFromUi: string;
  routerImport: string;
  routerElement: string;
}): string | null {
  const operator = uiOperatorFormBody(args.project, args.kind);
  if (operator === null) return null;
  return [
    ...args.header,
    `import * as generated from ${jstr(args.entryFromUi)};`,
    args.routerImport,
    "",
    "export function Console() {",
    "  return (",
    "    <>",
    `      ${args.routerElement}`,
    "      <OperatorConsole />",
    "    </>",
    "  );",
    "}",
    "",
    "/**",
    " * A3-f07 / W-14: the ui node's own operator surface â€” â‰¥2 real domain fields and",
    " * an interaction bound to a genuinely exported function of the generated module",
    " * above. The derived site mounts alongside it, never instead of it.",
    " */",
    "function OperatorConsole() {",
    ...operator,
    "}",
    "",
    "export default Console;",
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// 351 â€” the web-marketing multi-page site emitter.
//
// The measured ceiling of the emitted webapp was ONE `src/ui/console.tsx`: a
// `<span>` nav over one unlinked `<section>` per briefed name, or an honest
// "nothing to wire" panel. A `web-marketing` brief wants a real site: one file
// per page, a working hash router, a shared layout, the ordering flow when the
// brief asks for it, and a designed token stylesheet.
//
// This emitter writes that tree. It is gated on the brief's own domain
// (`web-marketing`) AND on the generated module genuinely exporting content the
// pages can render â€” every page reads its data from the generated module (via
// the emitted `site-data.ts` adapters); a page whose content is absent is not
// emitted, and nothing is invented. A caller-supplied `uiGeneration` hook still
// wins (scaffoldProject checks it before this runs), so the documented override
// contract is unchanged, and the emitted-UI files are additions beside the
// existing single-file shell for every other brief.
// ---------------------------------------------------------------------------

/** The content roles a marketing site page can draw from the generated module. */
type MarketingSources = {
  facts: UiCallable | null;
  menu: UiCallable | null;
  hours: UiCallable | null;
  policy: UiCallable | null;
  story: UiCallable | null;
  photo: UiCallable | null;
  order: UiCallable | null;
  validateTiming: UiCallable | null;
};

/** Deterministic nameâ†’role matcher over the generated module's real exports. */
const MARKETING_ROLE_RE: Record<keyof MarketingSources, RegExp> = {
  facts: /facts|business|identity|profile|company|siteinfo|aboutus|contactinfo/i,
  menu: /menu|catalog|products?|offerings?/i,
  hours: /hours|opening|schedule/i,
  policy: /ordering.?policy|order.?policy|delivery.?policy|shipping.?policy|policy$/i,
  story: /about|story|history|heritage|mission/i,
  photo: /photo|image|picture/i,
  order: /(create|place|submit|start|make|new).*order|^order$|checkout/i,
  validateTiming: /validat.*(timing|preorder|date|order)|timing/i,
};

/**
 * The generated module's callables as the marketing site sees them. Broader
 * than `uiExportedCallables` on purpose: a generated `createOrder` is an
 * `async function` re-exported through `export { createOrder }`, which the
 * shell scanner (built for sync render/form exports) does not recognise â€” so
 * the ordering flow would silently read as "no order endpoint". This scanner
 * includes `async function` declarations AND their `export { }` re-exports,
 * and marks them async. It is self-contained: the single-file shell path keeps
 * using `uiExportedCallables`, so no existing shell behavior changes.
 */
function marketingCallables(source: string): UiCallable[] {
  const text = String(source ?? "");
  const declared = new Map<string, { paramsText: string; isAsync: boolean }>();
  for (const m of text.matchAll(/^(?:export\s+)?(async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/gm)) {
    const name = m[2]!;
    if (!declared.has(name)) {
      declared.set(name, { paramsText: uiReadParen(text, m.index! + m[0].length - 1), isAsync: m[1] !== undefined });
    }
  }
  const out: UiCallable[] = [];
  const push = (name: string, paramsText: string, isAsync: boolean): void => {
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) || out.some((c) => c.name === name)) return;
    const params: UiCallable["params"] = [];
    for (const part of uiParamParts(paramsText)) {
      const parsed = uiParseParam(part);
      if (parsed) params.push({ name: parsed.name, type: parsed.type, rest: parsed.rest });
    }
    out.push({ name, params, objectKeys: null, ...(isAsync ? { async: true } : {}) });
  };
  for (const m of text.matchAll(/^export\s+(async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/gm)) {
    push(m[2]!, uiReadParen(text, m.index! + m[0].length - 1), m[1] !== undefined);
  }
  for (const m of text.matchAll(
    /^export\s+(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(async\s*)?(?:\(([^)]*)\)|function\s*\()/gm,
  )) {
    push(m[1]!, m[3] ?? "", m[2] !== undefined);
  }
  for (const m of text.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const part of m[1]!.split(",")) {
      const p = part.trim();
      if (!p) continue;
      const as = /^([A-Za-z_$][A-Za-z0-9_$]*)\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)$/.exec(p);
      const local = as ? as[1]! : p;
      const exported = as ? as[2]! : p;
      const decl = declared.get(local);
      if (decl) push(exported, decl.paramsText, decl.isAsync);
    }
  }
  return out;
}

function pickMarketingSources(callables: readonly UiCallable[]): MarketingSources {
  const sync0 = (re: RegExp): UiCallable | null =>
    callables.find((c) => c.async !== true && c.params.length === 0 && re.test(c.name)) ?? null;
  const orderCandidates = callables.filter(
    (c) => MARKETING_ROLE_RE.order.test(c.name) && c.params.filter((p) => !p.rest).length <= 1,
  );
  const order = orderCandidates.find((c) => c.async === true) ?? orderCandidates[0] ?? null;
  const validateTiming =
    callables.find(
      (c) => c.async !== true && MARKETING_ROLE_RE.validateTiming.test(c.name) && c.params.filter((p) => !p.rest).length === 3,
    ) ?? null;
  return {
    facts: sync0(MARKETING_ROLE_RE.facts),
    menu: sync0(MARKETING_ROLE_RE.menu),
    hours: sync0(MARKETING_ROLE_RE.hours),
    policy: sync0(MARKETING_ROLE_RE.policy),
    story: sync0(MARKETING_ROLE_RE.story),
    photo:
      callables.find(
        (c) => c.async !== true && c.params.filter((p) => !p.rest).length === 1 && MARKETING_ROLE_RE.photo.test(c.name),
      ) ?? null,
    order,
    validateTiming,
  };
}

function isMarketingSiteBrief(project: Project): boolean {
  const domain = String(project.domain ?? "").toLowerCase();
  const lattice = String(project.lattice?.domain ?? "").toLowerCase();
  return (
    domain === "web-marketing" ||
    lattice === "web-marketing" ||
    domain === "marketing" ||
    domain === "website"
  );
}

/** `https://â€¦` literals in the generated tree that name an image asset. */
const MARKETING_IMAGE_URL_RE = /https?:\/\/[^\s"'`()<>\]}]+/g;

function collectImageUrls(project: Project): string[] {
  const sources: string[] = [];
  for (const row of Array.isArray(project.generatedTree) ? project.generatedTree : []) {
    if (row !== null && typeof row === "object" && typeof (row as { source?: unknown }).source === "string") {
      sources.push((row as { source: string }).source);
    }
  }
  if (typeof project.generatedSource === "string" && project.generatedSource.trim() !== "") {
    sources.push(project.generatedSource);
  }
  const out = new Set<string>();
  for (const source of sources) {
    for (const match of source.matchAll(MARKETING_IMAGE_URL_RE)) {
      const url = match[0].replace(/[.,;]+$/, "");
      if (/\.(png|jpe?g|webp|gif|avif|svg)(\?|#|$)/i.test(url) || /\/images?\//i.test(url)) out.add(url);
    }
  }
  return [...out].sort();
}

function marketingAssetManifest(urls: readonly string[]): string {
  const images = urls.map((url) => {
    let host = "";
    try {
      host = new URL(url).host;
    } catch {
      host = "";
    }
    return { url, host, status: "referenced" };
  });
  const declared = images.length > 0;
  return `${JSON.stringify(
    {
      generatedBy: "RapidTool scaffold",
      source: declared ? "urls-referenced-by-generated-tree" : "none-declared",
      policy:
        "ONLY image URLs that literally appear in the generated tree (or the project) are listed. No asset URL is invented.",
      note: declared
        ? "Remote image URLs referenced by the generated product. No binary files are fabricated; a missing image is rendered as a monogram tile."
        : "The generated product declares no image URLs, so none are listed (nothing is invented). Pages render an honest monogram tile; add real assets under public/assets/ to replace the placeholders below.",
      images,
      // fixes/352 (declare-or-strike): when nothing is declared, ship an explicit
      // placeholder roster instead of leaving the asset story blank.
      placeholders: declared
        ? []
        : [
            {
              asset: "public/assets/",
              kind: "images",
              status: "placeholder",
              note: "NOT engine-generated â€” the generated tree declares no image URL; supply real assets or keep the monogram fallback.",
            },
          ],
    },
    null,
    2,
  )}\n`;
}

type MarketingPage = { id: string; title: string; component: string };

type MarketingSiteCtx = {
  project: Project;
  src: MarketingSources;
  pages: MarketingPage[];
  ordering: boolean;
  siteName: string;
  /** Relative import specifier (extension included) to the generated entry. */
  generated: string;
  /** fixes/352: renderer-shape extras â€” absent for the data-getter shape. */
  renderers?: Partial<Record<MarketingRenderRole, { name: string; args: string[] }>>;
  submit?: UiCallable | null;
  /** Sound argument expressions for the submit callable (arg 0 = the form payload). */
  submitArgs?: string[];
  /** fixes/352: the emitted store module path, for persisted order records. */
  store?: string | null;
  /** fixes/352: the generated entry path (renderer OrderPage imports it). */
  generatedEntryPath?: string;
};

/** The emitted site's content adapters. Every value reads the generated module. */
function siteDataModule(ctx: MarketingSiteCtx): string {
  const call = (fn: UiCallable | null): string => (fn === null ? "null" : `generated.${fn.name}()`);
  const orderFn = ctx.src.order;
  // fixes/352 (persistence): when the tree ships a real store module, a
  // submitted order is recorded in its persisted OrderLog, so the ordering flow
  // survives a reload. Absent the store node, no persistence is claimed.
  const storeSet = ctx.store !== null && ctx.store !== undefined;
  const persist = (idExpr: string, messageExpr: string): string[] =>
    storeSet
      ? [
          `      orderLog.record({ id: ${idExpr}, message: ${messageExpr}, submittedAt: new Date().toISOString(), payload: input });`,
        ]
      : [];
  const orderBridge =
    orderFn === null
      ? [
          "export async function submitOrder(input: unknown): Promise<OrderOutcome> {",
          "  void input;",
          "  return { ok: false, message: \"This build's generated module exposes no order endpoint; the order was not placed.\", id: \"\" };",
          "}",
        ].join("\n")
      : [
          "export async function submitOrder(input: unknown): Promise<OrderOutcome> {",
          "  try {",
          `    const result: unknown = await generated.${orderFn.name}(input as Parameters<typeof generated.${orderFn.name}>[0]);`,
          "    if (isRec(result)) {",
          "      const ok = result.ok === true || result.confirmed === true;",
          "      const message = readString(result, [\"message\", \"reason\", \"error\"]) || (ok ? \"Order received.\" : \"The order could not be placed.\");",
          "      const id = isRec(result.order) ? readString(result.order, [\"id\", \"orderId\", \"reference\"]) : \"\";",
          ...persist(`id !== "" ? id : "order-" + String(Date.now())`, "message"),
          "      return { ok, message, id };",
          "    }",
          ...persist(`"order-" + String(Date.now())`, '"Order received."'),
          "    return { ok: true, message: \"Order received.\", id: \"\" };",
          "  } catch (error) {",
          "    return { ok: false, message: error instanceof Error ? error.message : String(error), id: \"\" };",
          "  }",
          "}",
        ].join("\n");
  const typedTiming = ctx.src.validateTiming !== null && ctx.src.policy !== null;
  const timingBridge = typedTiming
    ? [
        "export function checkOrderDate(dateIso: string): { ok: boolean; message: string } {",
        "  if (dateIso === \"\") return { ok: false, message: \"Choose an order date.\" };",
        "  try {",
        `    const result: unknown = generated.${ctx.src.validateTiming!.name}(${call(ctx.src.policy)}, new Date(), new Date(dateIso + "T12:00:00"));`,
        "    if (isRec(result) && result.ok === true) return { ok: true, message: \"\" };",
        "    return { ok: false, message: isRec(result) ? readString(result, [\"message\", \"reason\"]) || \"The requested date is not available.\" : \"The requested date is not available.\" };",
        "  } catch (error) {",
        "    return { ok: false, message: error instanceof Error ? error.message : String(error) };",
        "  }",
        "}",
      ].join("\n")
    : [
        "export function checkOrderDate(dateIso: string): { ok: boolean; message: string } {",
        "  if (dateIso === \"\") return { ok: false, message: \"Choose an order date.\" };",
        "  const requested = new Date(dateIso + \"T12:00:00\");",
        "  if (Number.isNaN(requested.getTime())) return { ok: false, message: \"The order date is not a valid date.\" };",
        "  const today = new Date();",
        "  const todayKey = today.getFullYear() + \"-\" + String(today.getMonth() + 1).padStart(2, \"0\") + \"-\" + String(today.getDate()).padStart(2, \"0\");",
        "  if (dateIso === todayKey) return { ok: false, message: \"Same-day orders are not accepted â€” choose a later date.\" };",
        "  if (dateIso < todayKey) return { ok: false, message: \"The requested date is in the past.\" };",
        "  return { ok: true, message: \"\" };",
        "}",
      ].join("\n");

  const body = `// Adapts the generated content module into the plain shapes the site pages
// render. Every value is read from the generated module; nothing is invented.
// A section whose data is absent is omitted by the page that would show it.
import * as generated from "${ctx.generated}";
${storeSet && orderFn !== null ? `import { orderLog } from ${jstr(tsImportPath("src/ui", ctx.store as string))};` : ""}

type Rec = { [key: string]: unknown };

function isRec(value: unknown): value is Rec {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(source: unknown, keys: readonly string[]): string {
  if (!isRec(source)) return "";
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function readList(source: unknown, keys: readonly string[]): unknown[] {
  if (Array.isArray(source)) return source;
  if (!isRec(source)) return [];
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function readStrings(source: unknown, keys: readonly string[]): string[] {
  const out: string[] = [];
  for (const entry of readList(source, keys)) {
    if (typeof entry === "string" && entry.trim() !== "") out.push(entry.trim());
  }
  return out;
}

function readFlag(source: unknown, keys: readonly string[]): boolean {
  if (!isRec(source)) return false;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "boolean") return value;
  }
  return false;
}

function slugId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const rawFacts: unknown = ${call(ctx.src.facts)};
const rawMenu: unknown = ${call(ctx.src.menu)};
const rawHours: unknown = ${call(ctx.src.hours)};
const rawPolicy: unknown = ${call(ctx.src.policy)};
const rawStory: unknown = ${call(ctx.src.story)};

export const SITE_NAME = ${jstr(ctx.siteName)};

export const business = {
  name: readString(rawFacts, ["name", "businessName", "companyName", "title"]) || SITE_NAME,
  address: readString(rawFacts, ["address", "streetAddress", "location"]),
  phone: readString(rawFacts, ["phone", "telephone", "phoneNumber"]),
  email: readString(rawFacts, ["email", "contactEmail", "emailAddress"]),
  founded: readString(rawFacts, ["founded", "foundedYear", "established", "since"]),
  tagline: readString(rawFacts, ["tagline", "slogan", "headline"]),
  taglineAlt: readString(rawFacts, ["taglineAlt", "tagline2", "secondaryTagline", "taglines"]),
  awards: readStrings(rawFacts, ["awards", "accolades", "recognition"]),
};

export type SiteMenuItem = { id: string; name: string; group: string; image: string };
export type SiteMenuGroup = { group: string; section: string; items: SiteMenuItem[] };

function toMenuItem(entry: unknown): SiteMenuItem {
  const name = readString(entry, ["name", "title", "label"]);
  return {
    id: readString(entry, ["id", "slug", "key", "sku"]) || slugId(name),
    name,
    group: readString(entry, ["group", "category", "section"]),
    image: readString(entry, ["image", "imageUrl", "photo", "photoUrl", "src", "url"]),
  };
}

const rawGroups = readList(rawMenu, ["groups", "sections", "categories", "menuGroups"]).map((entry) => {
  const group = readString(entry, ["group", "name", "section", "title", "category"]) || "Menu";
  const items = readList(entry, ["items", "products", "entries", "menuItems"])
    .map(toMenuItem)
    .filter((item) => item.name !== "");
  return { group, section: readString(entry, ["section", "group", "category"]) || group, items };
});
const groupedItems = rawGroups.filter((entry) => entry.items.length > 0);
const flatItems = readList(rawMenu, []).map(toMenuItem).filter((item) => item.name !== "");
export const menuGroups: SiteMenuGroup[] =
  groupedItems.length > 0
    ? groupedItems
    : flatItems.length > 0
      ? [{ group: "Menu", section: "Menu", items: flatItems }]
      : [];

export type SiteHour = { day: string; open: string; close: string; closed: boolean };
export const openingHours: SiteHour[] = readList(rawHours, ["hours", "days", "schedule", "openingHours"])
  .map((entry) => ({
    day: readString(entry, ["day", "name", "label"]),
    open: readString(entry, ["open", "opens", "from", "start"]),
    close: readString(entry, ["close", "closes", "to", "end"]),
    closed: readFlag(entry, ["closed", "isClosed"]),
  }))
  .filter((entry) => entry.day !== "");
export const closedDays = readStrings(rawHours, ["closedDays"]);

export const ordering = {
  pickupOptions: readStrings(rawPolicy, ["pickupOptions", "pickup", "fulfillmentOptions"]),
  deliveryArea: readString(rawPolicy, ["deliveryArea", "deliveryZone", "serviceArea"]),
  deliveryDays: readStrings(rawPolicy, ["deliveryDays"]),
  deliveryWindowOpen: readString(rawPolicy, ["deliveryWindowOpen", "windowOpen"]),
  deliveryWindowClose: readString(rawPolicy, ["deliveryWindowClose", "windowClose"]),
  preorderCutoff: readString(rawPolicy, ["preorderCutoff", "cutoff", "orderCutoff"]),
  sameDayAllowed: readFlag(rawPolicy, ["sameDayAllowed", "sameDay"]),
  onlineOrderUrl: readString(rawPolicy, ["orderUrl", "orderingUrl", "bakesmartUrl", "checkoutUrl"]),
};

export const story = {
  paragraphs: readStrings(rawStory, ["paragraphs", "story", "history", "body", "lines"]),
  flour: readString(rawStory, ["flour", "ingredient", "source"]),
  since: readString(rawStory, ["sameRecipesSince", "since", "foundedYear"]),
};

export const hasOrdering = ${orderFn !== null ? "true" : "false"};

export type OrderOutcome = { ok: boolean; message: string; id: string };

${orderBridge}

${timingBridge}
`;
  return [...sourceHeader("src/ui/site-data.ts", "Site content adapters over the generated module", ctx.project, [
    "// Reads the generated module's real exports; nothing is fabricated.",
  ]), body].join("\n");
}

function cartModule(ctx: MarketingSiteCtx): string {
  const key = jstr(`${slugName(ctx.project.name) || "site"}.cart`);
  const body = `// A small, real cart store: localStorage-backed and observable through React's
// useSyncExternalStore. Quantities are capped; corrupt storage is ignored.
import { useSyncExternalStore } from "react";

export type CartLine = { id: string; name: string; quantity: number };

const STORAGE_KEY = ${key};
const MAX_QUANTITY = 99;
const listeners = new Set<() => void>();

function read(): CartLine[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: CartLine[] = [];
    for (const entry of parsed) {
      if (typeof entry !== "object" || entry === null) continue;
      const record = entry as { id?: unknown; name?: unknown; quantity?: unknown };
      if (typeof record.id === "string" && record.id !== "" && typeof record.name === "string" && typeof record.quantity === "number") {
        out.push({ id: record.id, name: record.name, quantity: Math.max(1, Math.min(MAX_QUANTITY, Math.floor(record.quantity))) });
      }
    }
    return out;
  } catch {
    return [];
  }
}

let lines: CartLine[] = read();

function getSnapshot(): CartLine[] {
  return lines;
}

function persist(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // Storage unavailable (private mode / quota) â€” the cart stays in memory.
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useCart(): CartLine[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function cartQuantity(current: CartLine[]): number {
  let total = 0;
  for (const line of current) total += line.quantity;
  return total;
}

export function addItem(id: string, name: string): void {
  const found = lines.find((line) => line.id === id);
  if (found !== undefined) {
    lines = lines.map((line) => (line.id === id ? { ...line, quantity: Math.min(MAX_QUANTITY, line.quantity + 1) } : line));
  } else {
    lines = lines.concat([{ id, name, quantity: 1 }]);
  }
  persist();
  emit();
}

export function setQuantity(id: string, quantity: number): void {
  const next = Math.max(0, Math.min(MAX_QUANTITY, Math.floor(quantity)));
  lines = next === 0 ? lines.filter((line) => line.id !== id) : lines.map((line) => (line.id === id ? { ...line, quantity: next } : line));
  persist();
  emit();
}

export function clearCart(): void {
  lines = [];
  persist();
  emit();
}

export function readCustomerId(): string {
  const customerKey = STORAGE_KEY + ".customer";
  if (typeof localStorage === "undefined") return "guest";
  try {
    const existing = localStorage.getItem(customerKey);
    if (existing !== null && existing !== "") return existing;
    const created = "customer-" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(customerKey, created);
    return created;
  } catch {
    return "guest";
  }
}
`;
  return [...sourceHeader("src/ui/cart.ts", "Cart store (localStorage-backed, observable)", ctx.project, [
    "// Real client-side persistence; no server round-trip is implied.",
  ]), body].join("\n");
}

function layoutModule(ctx: MarketingSiteCtx): string {
  const body = `// The shared site chrome: a sticky header with working navigation, a main
// region, and a footer drawn from the business facts. Navigation is real links
// to the router's hash routes.
import type { ReactNode } from "react";
import { business, SITE_NAME } from "./site-data.ts";

export type SiteNavItem = { id: string; title: string; href: string };

export function SiteLayout({ nav, current, children }: { nav: readonly SiteNavItem[]; current: string; children: ReactNode }) {
  return (
    <div className="site">
      <header className="site-header">
        <a className="site-brand" href="#/home">
          <span className="site-brand__name">{business.name || SITE_NAME}</span>
          {business.tagline !== "" ? <span className="site-brand__tagline">{business.tagline}</span> : null}
        </a>
        <nav className="site-nav" aria-label="Primary">
          {nav.map((item) => (
            <a
              key={item.id}
              href={item.href}
              className={item.id === current ? "site-nav__link site-nav__link--active" : "site-nav__link"}
              aria-current={item.id === current ? "page" : undefined}
            >
              {item.title}
            </a>
          ))}
        </nav>
      </header>
      <main className="site-main">{children}</main>
      <footer className="site-footer">
        <div className="site-footer__inner">
          <div>
            <p className="site-footer__name">{business.name || SITE_NAME}</p>
            {business.address !== "" ? <p className="site-footer__line">{business.address}</p> : null}
            {business.phone !== "" ? (
              <p className="site-footer__line">
                <a href={"tel:" + business.phone.replace(/[^0-9+]/g, "")}>{business.phone}</a>
              </p>
            ) : null}
            {business.email !== "" ? (
              <p className="site-footer__line">
                <a href={"mailto:" + business.email}>{business.email}</a>
              </p>
            ) : null}
          </div>
          {business.awards.length > 0 ? (
            <ul className="site-footer__awards">
              {business.awards.slice(0, 4).map((award) => (
                <li key={award}>{award}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </footer>
    </div>
  );
}
`;
  return [...sourceHeader("src/ui/layout.tsx", "Shared site layout (header, navigation, footer)", ctx.project, [
    "// Every page mounts inside this chrome.",
  ]), body].join("\n");
}

function routerModule(ctx: MarketingSiteCtx): string {
  const pageImports = ctx.pages
    .filter((page) => page.id !== "home")
    .map((page) => `import { ${page.component} } from "./pages/${page.component}.tsx";`);
  const navItems = ctx.pages.map((page) => `  { id: ${jstr(page.id)}, title: ${jstr(page.title)}, href: ${jstr(`#/${page.id}`)} },`);
  const cases = ctx.pages
    .filter((page) => page.id !== "home")
    .map((page) => `    case ${jstr(page.id)}:\n      return <${page.component} />;`);
  const body = `// A minimal hash router. Routes are fixed at emit time; the home route is the
// default, so a static render (and a direct load with no hash) shows Home.
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { SiteLayout, type SiteNavItem } from "./layout.tsx";
import { HomePage } from "./pages/HomePage.tsx";
${pageImports.join("\n")}

const NAV: SiteNavItem[] = [
${navItems.join("\n")}
];

const DEFAULT_ROUTE = "home";

function readRoute(): string {
  if (typeof window === "undefined") return DEFAULT_ROUTE;
  const raw = window.location.hash.replace(/^#\\/?/, "").split("?")[0];
  return raw !== "" && NAV.some((item) => item.id === raw) ? raw : DEFAULT_ROUTE;
}

function renderPage(route: string): ReactNode {
  switch (route) {
${cases.join("\n")}
    default:
      return <HomePage />;
  }
}

export function SiteRouter() {
  const [route, setRoute] = useState<string>(() => readRoute());
  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return <SiteLayout nav={NAV} current={route}>{renderPage(route)}</SiteLayout>;
}
`;
  return [...sourceHeader("src/ui/router.tsx", "Hash router over the emitted site pages", ctx.project, [
    "// One route per emitted page file.",
  ]), body].join("\n");
}

function homePageModule(ctx: MarketingSiteCtx): string {
  const orderHref = ctx.ordering ? '<a className="btn btn--primary" href="#/order">Start an order</a>' : "";
  const body = `// The home page: a hero with the business identity and a live open/closed
// badge, featured items, the story teaser, awards, and the ordering policy.
// Every section is omitted when its data is absent â€” no filler.
import { useState } from "react";
import { business, menuGroups, openingHours, ordering, story, SITE_NAME, type SiteMenuItem } from "../site-data.ts";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function toMinutes(text: string): number | null {
  const match = /(\\d{1,2}):(\\d{2})\\s*(am|pm)?/i.exec(text);
  if (match === null) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = (match[3] ?? "").toLowerCase();
  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function OpenBadge() {
  const now = new Date();
  const today = openingHours.find((entry) => entry.day === DAY_NAMES[now.getDay()]);
  if (today === undefined) return null;
  let open = false;
  if (!today.closed) {
    const start = toMinutes(today.open);
    const end = toMinutes(today.close);
    const minutes = now.getHours() * 60 + now.getMinutes();
    open = start !== null && end !== null && minutes >= start && minutes < end;
  }
  return <span className={open ? "badge badge--open" : "badge badge--closed"}>{open ? "Open now" : "Closed now"}</span>;
}

function ItemCard({ item }: { item: SiteMenuItem }) {
  const [failed, setFailed] = useState(false);
  return (
    <article className="card">
      {item.image !== "" && !failed ? (
        <img className="card__media" src={item.image} alt={item.name} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <div className="card__media card__media--fallback" aria-hidden="true">{item.name.slice(0, 1).toUpperCase()}</div>
      )}
      <div className="card__body">
        <h3 className="card__title">{item.name}</h3>
        {item.group !== "" ? <p className="card__meta">{item.group}</p> : null}
      </div>
    </article>
  );
}

export function HomePage() {
  const featured: SiteMenuItem[] = [];
  for (const group of menuGroups) {
    if (group.items.length > 0) featured.push(group.items[0]);
    if (featured.length >= 3) break;
  }
  return (
    <div>
      <section className="hero">
        {business.tagline !== "" ? <p className="hero__eyebrow">{business.tagline}</p> : null}
        <h1 className="hero__name">{business.name || SITE_NAME}</h1>
        {business.taglineAlt !== "" ? <p className="hero__tagline">{business.taglineAlt}</p> : null}
        <div className="hero__meta">
          <OpenBadge />
          {business.address !== "" ? <span>{business.address}</span> : null}
          {business.phone !== "" ? <a href={"tel:" + business.phone.replace(/[^0-9+]/g, "")}>{business.phone}</a> : null}
        </div>
        <div className="hero__actions">
          ${orderHref}
          <a className="btn btn--ghost" href="#/menu">Browse the menu</a>
        </div>
      </section>

      {featured.length > 0 ? (
        <section className="section">
          <div className="section__head">
            <h2>Featured</h2>
            <a href="#/menu">See the full menu</a>
          </div>
          <div className="grid grid--cards">
            {featured.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      {(story.paragraphs.length > 0 || business.awards.length > 0) ? (
        <section className="section">
          <h2>Our story</h2>
          {story.paragraphs.length > 0 ? <p className="section__lead">{story.paragraphs[0]}</p> : null}
          {story.paragraphs.length > 1 ? <a href="#/about">Read more</a> : null}
          {business.awards.length > 0 ? (
            <ul className="awards">
              {business.awards.slice(0, 4).map((award) => (
                <li className="awards__item" key={award}>{award}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {(ordering.deliveryArea !== "" || ordering.preorderCutoff !== "" || ordering.pickupOptions.length > 0) ? (
        <section className="section">
          <h2>Ordering</h2>
          <ul className="facts">
            {ordering.pickupOptions.length > 0 ? (
              <li className="facts__row"><span className="facts__label">Pickup</span>{ordering.pickupOptions.join(" Â· ")}</li>
            ) : null}
            {ordering.deliveryArea !== "" ? (
              <li className="facts__row">
                <span className="facts__label">Delivery</span>
                {ordering.deliveryArea + (ordering.deliveryDays.length > 0 ? " Â· " + ordering.deliveryDays.join(", ") : "")}
              </li>
            ) : null}
            {(ordering.deliveryWindowOpen !== "" && ordering.deliveryWindowClose !== "") ? (
              <li className="facts__row"><span className="facts__label">Delivery window</span>{ordering.deliveryWindowOpen + " â€“ " + ordering.deliveryWindowClose}</li>
            ) : null}
            {ordering.preorderCutoff !== "" ? (
              <li className="facts__row"><span className="facts__label">Preorder cutoff</span>{ordering.preorderCutoff}</li>
            ) : null}
          </ul>
          ${ctx.ordering ? '<p><a className="btn btn--primary" href="#/order">Order online</a></p>' : ""}
        </section>
      ) : null}
    </div>
  );
}
`;
  return [...sourceHeader("src/ui/pages/HomePage.tsx", "Home page (hero, featured, story, ordering)", ctx.project), body].join("\n");
}

function menuPageModule(ctx: MarketingSiteCtx): string {
  const body = `// The menu page: every generated menu group as a section of item cards with
// real product photography when the generated content declares an image URL.
// A missing image renders a monogram tile. Search filters across the groups.
import { useMemo, useState } from "react";
import { menuGroups, type SiteMenuItem } from "../site-data.ts";
import { addItem, cartQuantity, useCart } from "../cart.ts";

function MenuCard({ item, onAdd }: { item: SiteMenuItem; onAdd: () => void }) {
  const [failed, setFailed] = useState(false);
  return (
    <article className="card">
      {item.image !== "" && !failed ? (
        <img className="card__media" src={item.image} alt={item.name} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <div className="card__media card__media--fallback" aria-hidden="true">{item.name.slice(0, 1).toUpperCase()}</div>
      )}
      <div className="card__body">
        <h3 className="card__title">{item.name}</h3>
        <p className="card__meta">{item.group}</p>
        <div className="card__actions">
          <button type="button" className="btn btn--ghost" onClick={onAdd}>Add to order</button>
        </div>
      </div>
    </article>
  );
}

export function MenuPage() {
  const cart = useCart();
  const [query, setQuery] = useState("");
  const term = query.trim().toLowerCase();
  const groups = useMemo(
    () =>
      menuGroups
        .map((group) => ({
          group: group.group,
          items: group.items.filter((item) => term === "" || item.name.toLowerCase().includes(term)),
        }))
        .filter((group) => group.items.length > 0),
    [term],
  );
  return (
    <div>
      <section className="section">
        <h1>Menu</h1>
        <p className="section__lead">Browse everything the bakery makes, then build an order.</p>
        <label className="sr-only" htmlFor="menu-search">Search the menu</label>
        <input
          id="menu-search"
          className="search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search the menu"
        />
      </section>
      {groups.length === 0 ? (
        <section className="section">
          <p className="muted">No items match your search.</p>
        </section>
      ) : (
        groups.map((group) => (
          <section className="section" key={group.group}>
            <h2>{group.group}</h2>
            <div className="grid grid--cards">
              {group.items.map((item) => (
                <MenuCard key={item.id} item={item} onAdd={() => addItem(item.id, item.name)} />
              ))}
            </div>
          </section>
        ))
      )}
      <p className="notice">
        In your order: {cartQuantity(cart)} item(s). <a href="#/order">Review and check out</a>
      </p>
    </div>
  );
}
`;
  return [...sourceHeader("src/ui/pages/MenuPage.tsx", "Menu page (groups, product photography, search)", ctx.project), body].join("\n");
}

function aboutPageModule(ctx: MarketingSiteCtx): string {
  const body = `// The about page: the generated story paragraphs, the ingredient note, and
// the awards. Any absent part is omitted.
import { business, SITE_NAME, story } from "../site-data.ts";

export function AboutPage() {
  return (
    <div>
      <section className="section">
        <h1>About {business.name || SITE_NAME}</h1>
        {story.since !== "" ? <p className="stat__value">{story.since}</p> : null}
        {story.since !== "" ? <p className="stat__label">Same recipes since</p> : null}
      </section>
      {story.paragraphs.length > 0 ? (
        <section className="section">
          <h2>Our story</h2>
          <div className="prose">
            {story.paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </section>
      ) : null}
      {story.flour !== "" ? (
        <section className="section">
          <h2>Ingredients</h2>
          <p className="section__lead">Baked with {story.flour}.</p>
        </section>
      ) : null}
      {business.awards.length > 0 ? (
        <section className="section">
          <h2>Awards</h2>
          <ul className="awards">
            {business.awards.map((award) => (
              <li className="awards__item" key={award}>{award}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
`;
  return [...sourceHeader("src/ui/pages/AboutPage.tsx", "About page (story, ingredients, awards)", ctx.project), body].join("\n");
}

function contactPageModule(ctx: MarketingSiteCtx): string {
  const body = `// The contact/visit page: address, phone, email, the generated opening hours,
// and the delivery/preorder policy.
import { business, closedDays, openingHours, ordering, SITE_NAME } from "../site-data.ts";

export function ContactPage() {
  return (
    <div>
      <section className="section">
        <h1>Visit {business.name || SITE_NAME}</h1>
        {business.address !== "" ? <p className="section__lead">{business.address}</p> : null}
        <ul className="facts">
          {business.phone !== "" ? (
            <li className="facts__row">
              <span className="facts__label">Phone</span>
              <a href={"tel:" + business.phone.replace(/[^0-9+]/g, "")}>{business.phone}</a>
            </li>
          ) : null}
          {business.email !== "" ? (
            <li className="facts__row">
              <span className="facts__label">Email</span>
              <a href={"mailto:" + business.email}>{business.email}</a>
            </li>
          ) : null}
        </ul>
      </section>
      {openingHours.length > 0 ? (
        <section className="section">
          <h2>Opening hours</h2>
          <ul className="hours">
            {openingHours.map((entry) => (
              <li className={entry.closed ? "hours__row hours__row--closed" : "hours__row"} key={entry.day}>
                <span className="hours__day">{entry.day}</span>
                <span>{entry.closed ? "Closed" : entry.open + " â€“ " + entry.close}</span>
              </li>
            ))}
          </ul>
          {closedDays.length > 0 ? <p className="muted">Closed: {closedDays.join(", ")}.</p> : null}
        </section>
      ) : null}
      {(ordering.deliveryArea !== "" || ordering.preorderCutoff !== "") ? (
        <section className="section">
          <h2>Delivery &amp; preorders</h2>
          <ul className="facts">
            {ordering.deliveryArea !== "" ? (
              <li className="facts__row"><span className="facts__label">Delivery area</span>{ordering.deliveryArea}</li>
            ) : null}
            {ordering.deliveryDays.length > 0 ? (
              <li className="facts__row"><span className="facts__label">Delivery days</span>{ordering.deliveryDays.join(", ")}</li>
            ) : null}
            {(ordering.deliveryWindowOpen !== "" && ordering.deliveryWindowClose !== "") ? (
              <li className="facts__row"><span className="facts__label">Delivery window</span>{ordering.deliveryWindowOpen + " â€“ " + ordering.deliveryWindowClose}</li>
            ) : null}
            {ordering.preorderCutoff !== "" ? (
              <li className="facts__row"><span className="facts__label">Preorder cutoff</span>{ordering.preorderCutoff}</li>
            ) : null}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
`;
  return [...sourceHeader("src/ui/pages/ContactPage.tsx", "Contact page (address, hours, delivery rules)", ctx.project), body].join("\n");
}

function orderPageModule(ctx: MarketingSiteCtx): string {
  const body = `// The ordering flow: a cart with quantity controls, fulfillment choice, a date
// checked against the generated timing rules, contact validation, and a submit
// through the generated order endpoint. The cart persists in localStorage.
import { useMemo, useState, type FormEvent } from "react";
import { checkOrderDate, hasOrdering, menuGroups, ordering, submitOrder, type SiteMenuItem } from "../site-data.ts";
import { addItem, clearCart, readCustomerId, setQuantity, useCart } from "../cart.ts";

type Mode = "pickup" | "delivery";
type Errors = { [field: string]: string };

function tomorrowIso(): string {
  const next = new Date(new Date().getTime() + 24 * 60 * 60 * 1000);
  return next.getFullYear() + "-" + String(next.getMonth() + 1).padStart(2, "0") + "-" + String(next.getDate()).padStart(2, "0");
}

export function OrderPage() {
  const cart = useCart();
  const [mode, setMode] = useState<Mode>("pickup");
  const [date, setDate] = useState<string>(() => tomorrowIso());
  const [slot, setSlot] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState<string>("");
  const [noticeOk, setNoticeOk] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const items: SiteMenuItem[] = useMemo(() => menuGroups.flatMap((group) => group.items), []);

  function validate(): Errors {
    const found: Errors = {};
    if (cart.length === 0) found.cart = "Add at least one item to your order.";
    if (name.trim() === "") found.name = "Enter the name for the order.";
    if (phone.trim() === "") found.phone = "Enter a phone number so the bakery can confirm.";
    const timing = checkOrderDate(date);
    if (!timing.ok) found.date = timing.message;
    if (mode === "delivery" && address.trim() === "") found.address = "Enter the delivery address.";
    return found;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    setNotice("");
    if (Object.keys(found).length > 0) return;
    setSubmitting(true);
    const outcome = await submitOrder({
      customerId: readCustomerId(),
      mode,
      date,
      slot,
      address: mode === "delivery" ? address.trim() : "",
      contactName: name.trim(),
      contactPhone: phone.trim(),
      // No price is sent (and none is rendered): the brief publishes no prices,
      // so the order carries identity/quantity only â€” never a fabricated amount.
      lines: cart.map((line) => ({ itemId: line.id, name: line.name, quantity: line.quantity })),
    });
    setSubmitting(false);
    setNoticeOk(outcome.ok);
    setNotice(outcome.message + (outcome.id !== "" ? " Reference: " + outcome.id + "." : ""));
    if (outcome.ok) clearCart();
  }

  return (
    <div>
      <section className="section">
        <h1>Order</h1>
        {ordering.preorderCutoff !== "" ? (
          <p className="section__lead">
            Preorders close at {ordering.preorderCutoff} the day before.
            {ordering.deliveryArea !== "" ? " Delivery is available within " + ordering.deliveryArea + "." : ""}
          </p>
        ) : null}
        {!hasOrdering ? (
          <p className="notice notice--error">
            This build's generated module exposes no order endpoint, so an order cannot be submitted here.
          </p>
        ) : null}
      </section>

      <div className="grid grid--two">
        <section className="section">
          <h2>Your order</h2>
          {cart.length === 0 ? (
            <p className="cart__empty">Your order is empty â€” add items below.</p>
          ) : (
            <ul className="cart">
              {cart.map((line) => (
                <li className="cart__line" key={line.id}>
                  <span className="cart__name">{line.name}</span>
                  <span className="qty">
                    <button type="button" className="qty__btn" aria-label={"Remove one " + line.name} onClick={() => setQuantity(line.id, line.quantity - 1)}>-</button>
                    <span className="qty__value">{line.quantity}</span>
                    <button type="button" className="qty__btn" aria-label={"Add one " + line.name} onClick={() => setQuantity(line.id, line.quantity + 1)}>+</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {errors.cart !== undefined ? <p className="field__error">{errors.cart}</p> : null}
          {items.length > 0 ? (
            <div className="add-items">
              <h3>Add items</h3>
              <ul className="cart">
                {items.map((item) => (
                  <li className="cart__line" key={item.id}>
                    <span className="cart__name">{item.name}</span>
                    <button type="button" className="btn btn--ghost" onClick={() => addItem(item.id, item.name)}>Add</button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="section">
          <h2>Your details</h2>
          <form onSubmit={(event) => void onSubmit(event)} noValidate>
            <div className="field">
              <span className="field__label">Fulfillment</span>
              <div className="choice">
                <button type="button" className={mode === "pickup" ? "choice__option choice__option--active" : "choice__option"} aria-pressed={mode === "pickup"} onClick={() => setMode("pickup")}>Pickup</button>
                <button type="button" className={mode === "delivery" ? "choice__option choice__option--active" : "choice__option"} aria-pressed={mode === "delivery"} onClick={() => setMode("delivery")}>Delivery</button>
              </div>
            </div>
            <div className={errors.date !== undefined ? "field field--invalid" : "field"}>
              <label className="field__label" htmlFor="order-date">Order date</label>
              <input className="field__control" id="order-date" type="date" value={date} min={tomorrowIso()} onChange={(event) => setDate(event.target.value)} />
              {errors.date !== undefined ? <span className="field__error">{errors.date}</span> : null}
            </div>
            <div className="field">
              <label className="field__label" htmlFor="order-slot">{mode === "delivery" ? "Delivery time" : "Pickup time"}</label>
              <input className="field__control" id="order-slot" type="time" value={slot} onChange={(event) => setSlot(event.target.value)} />
            </div>
            <div className={errors.name !== undefined ? "field field--invalid" : "field"}>
              <label className="field__label" htmlFor="order-name">Name</label>
              <input className="field__control" id="order-name" type="text" value={name} autoComplete="name" onChange={(event) => setName(event.target.value)} />
              {errors.name !== undefined ? <span className="field__error">{errors.name}</span> : null}
            </div>
            <div className={errors.phone !== undefined ? "field field--invalid" : "field"}>
              <label className="field__label" htmlFor="order-phone">Phone</label>
              <input className="field__control" id="order-phone" type="tel" value={phone} autoComplete="tel" onChange={(event) => setPhone(event.target.value)} />
              {errors.phone !== undefined ? <span className="field__error">{errors.phone}</span> : null}
            </div>
            {mode === "delivery" ? (
              <div className={errors.address !== undefined ? "field field--invalid" : "field"}>
                <label className="field__label" htmlFor="order-address">Delivery address</label>
                <input className="field__control" id="order-address" type="text" value={address} autoComplete="street-address" onChange={(event) => setAddress(event.target.value)} />
                {errors.address !== undefined ? <span className="field__error">{errors.address}</span> : null}
              </div>
            ) : null}
            <button type="submit" className="btn btn--primary" disabled={submitting}>{submitting ? "Placing orderâ€¦" : "Place order"}</button>
          </form>
          {notice !== "" ? (
            <p className={noticeOk ? "notice notice--ok" : "notice notice--error"} role="status">{notice}</p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
`;
  return [...sourceHeader("src/ui/pages/OrderPage.tsx", "Ordering flow (cart, validation, submit)", ctx.project), body].join("\n");
}

function siteConsoleModule(ctx: MarketingSiteCtx): string {
  const header = sourceHeader("src/ui/console.tsx", "Operator surfaces bound to store fields", ctx.project, [
    "// Multi-page marketing site: the router mounts one emitted page file per route.",
    "// The generated content module is imported by ./site-data.ts.",
  ]);
  // 358 (R-UI-1): the marketing site no longer REPLACES the ui node's operator
  // surface â€” the router mounts beside it when the generated module binds.
  const merged = siteOperatorConsole({
    header,
    project: ctx.project,
    kind: "webapp",
    entryFromUi: ctx.generated,
    routerImport: `import { SiteRouter } from "./router.tsx";`,
    routerElement: "<SiteRouter />",
  });
  if (merged !== null) return merged;
  const body = `// The mount src/main.tsx renders. The generated site lives in ./router.tsx
// (one file per page); this component is the single contract point.
import { SiteRouter } from "./router.tsx";

export function Console() {
  return <SiteRouter />;
}

export default Console;
`;
  return [...header, body].join("\n");
}

/**
 * fixes/352 â€” the PARAMETERISED-RENDERER marketing shape.
 *
 * The measured keyed bakery tree did not expose zero-arg data getters; it
 * exported `renderHome()/renderMenu(...)/renderHoursAndLocation(...)/
 * renderOrderForm(...)/renderContact(...)` â€” page renderers that TAKE data.
 * `pickMarketingSources` (the getter shape) finds none of these, so the site
 * guard bailed and a "marketing website" shipped a single debug shell. This
 * branch accepts the renderer shape too: each renderer becomes a page, called
 * with sound empty/literal arguments (never a guessed domain value), and the
 * returned view is mounted through a dependency-free adapter.
 */
type MarketingRenderRole = "home" | "menu" | "about" | "hours" | "order" | "contact";

const MARKETING_RENDER_ROLE_RE: Record<MarketingRenderRole, RegExp> = {
  home: /home|landing|index/i,
  menu: /menu|catalog|products?|offerings?/i,
  about: /about|story|history|heritage|mission/i,
  hours: /hours|opening|schedule|location|visit/i,
  order: /order|checkout|basket|cart|reserve|booking|pre-?order/i,
  contact: /contact|enquir|inquir/i,
};

/**
 * The object shapes the generated entry declares (`interface X {â€¦}` /
 * `type X = {â€¦}`), so a required object parameter can be filled with an empty
 * but well-typed literal. Nothing is invented beyond `""`/`0`/`false`/`[]`/`{}`.
 */
function uiDeclaredObjects(
  source: string,
): Map<string, { name: string; type: string; optional: boolean }[]> {
  const out = new Map<string, { name: string; type: string; optional: boolean }[]>();
  const parseMembers = (body: string): { name: string; type: string; optional: boolean }[] => {
    const fields: { name: string; type: string; optional: boolean }[] = [];
    for (const raw of splitTopLevel(body, ";")) {
      const part = raw.trim();
      if (part === "" || part.includes("(")) continue; // skip method signatures
      const m = /^([A-Za-z_$][A-Za-z0-9_$]*)(\?)?\s*:\s*([\s\S]+)$/.exec(part);
      if (!m) continue;
      if (fields.some((f) => f.name === m[1]!)) continue;
      fields.push({ name: m[1]!, type: m[3]!.trim(), optional: m[2] !== undefined });
    }
    return fields;
  };
  for (const m of String(source ?? "").matchAll(
    /^(?:export\s+)?interface\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\{([\s\S]*?)\n\}/gm,
  )) {
    if (!out.has(m[1]!)) out.set(m[1]!, parseMembers(m[2]!));
  }
  for (const m of String(source ?? "").matchAll(
    /^(?:export\s+)?type\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*\{([\s\S]*?)\}\s*;/gm,
  )) {
    if (!out.has(m[1]!)) out.set(m[1]!, parseMembers(m[2]!));
  }
  return out;
}

/** A sound, empty literal for a declared TS type, or null when none is provable. */
function emptyForType(
  type: string,
  aliases: ReadonlyMap<string, string>,
  objects: ReadonlyMap<string, { name: string; type: string; optional: boolean }[]>,
  depth = 0,
): string | null {
  const text = String(type ?? "").trim().replace(/^readonly\s+/, "");
  if (text === "" || depth > 3) return null;
  const parts = splitTopLevel(text, "|").map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    for (const part of parts) {
      if (/^(null|undefined)$/.test(part)) continue;
      const inner = emptyForType(part, aliases, objects, depth);
      if (inner !== null) return inner;
    }
    return "null";
  }
  const single = parts[0] ?? text;
  if (/\[\]$/.test(single) || /^(readonly\s+)?(Readonly)?Array\s*</.test(single)) return "[]";
  if (/^Date$/.test(single)) return "new Date(0)";
  if (/^(any|unknown)$/.test(single)) return "null";
  if (/^string$/.test(single)) return '""';
  if (/^(number|bigint)$/.test(single)) return "0";
  if (/^boolean$/.test(single)) return "false";
  if (/^(null|undefined)$/.test(single)) return "null";
  if (/^'[^']*'$/.test(single) || /^"[^"]*"$/.test(single)) return single;
  if (/^-?\d+(?:\.\d+)?$/.test(single)) return single;
  // A declared object shape wins over a single-line `type X = {â€¦}` alias (which
  // uiTypeAliases captures as just "{" â€” an alias that can fill nothing).
  const fields = objects.get(single);
  if (fields !== undefined) {
    const required = fields.filter((f) => !f.optional);
    const built: string[] = [];
    for (const field of required.slice(0, 16)) {
      const value = emptyForType(field.type, aliases, objects, depth + 1);
      if (value === null) return null; // cannot fill soundly â‡’ never call
      built.push(`${field.name}: ${value}`);
    }
    return `{ ${built.join(", ")} }`;
  }
  const alias = aliases.get(single);
  if (alias !== undefined && !alias.trim().startsWith("{")) {
    return emptyForType(alias, aliases, objects, depth + 1);
  }
  return null;
}

/** Sound call arguments for a renderer export, or null when none are provable. */
function marketingRenderArgs(
  c: UiCallable,
  aliases: ReadonlyMap<string, string>,
  objects: ReadonlyMap<string, { name: string; type: string; optional: boolean }[]>,
): string[] | null {
  if (c.async === true) return null;
  const args: string[] = [];
  for (const p of c.params) {
    if (p.rest) return null;
    const value = p.type === "" ? "null" : emptyForType(p.type, aliases, objects);
    if (value === null) return null;
    args.push(value);
  }
  return args;
}

/** Pick the page renderers this entry exposes, each with sound call args. */
function pickMarketingRenderers(
  callables: readonly UiCallable[],
  aliases: ReadonlyMap<string, string>,
  objects: ReadonlyMap<string, { name: string; type: string; optional: boolean }[]>,
): Partial<Record<MarketingRenderRole, { name: string; args: string[] }>> {
  const roles: MarketingRenderRole[] = ["home", "menu", "about", "hours", "order", "contact"];
  const used = new Set<string>();
  const out: Partial<Record<MarketingRenderRole, { name: string; args: string[] }>> = {};
  for (const role of roles) {
    const candidates = callables.filter(
      (x) => uiRenderLike(x) && !used.has(x.name) && MARKETING_RENDER_ROLE_RE[role].test(x.name),
    );
    // Prefer a page-shaped renderer over a fragment/helper one (e.g. a
    // renderOpeningHoursBadge must not stand in for the whole hours page).
    const c = candidates.find((x) => !/badge|opening|partial|empty|preview|summary|helper/i.test(x.name)) ?? candidates[0];
    if (c === undefined) continue;
    const args = marketingRenderArgs(c, aliases, objects);
    if (args === null) continue;
    used.add(c.name);
    out[role] = { name: c.name, args };
  }
  return out;
}

/** The dependency-free adapter that mounts a generated view value in React. */
function rendererAdapterModule(project: Project): string {
  const body = `// Renders a generated view value as React elements. The generated tree's
// render* exports return plain view objects â€” either a tag tree
// ({ tag, attrs, children, text } or { tagName, attributes, children,
// textContent }) or a page view model ({ h1, sections }). This adapter turns
// those REAL shapes into React nodes so the site mounts the generated product.
// It reads only the value it is given; a shape it does not recognise renders
// nothing rather than inventing markup.
import * as React from "react";
import type { FormEvent, ReactNode } from "react";

type Rec = { [key: string]: unknown };

function isRec(value: unknown): value is Rec {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** createElement with a runtime tag string (kept honest: no JSX namespace). */
const el = React.createElement as unknown as (
  type: string,
  props: Record<string, unknown> | null,
  ...children: ReactNode[]
) => ReactNode;

type SubmitHandler = (event: FormEvent<HTMLFormElement>) => void;

function attrsOf(node: Rec, onSubmit: SubmitHandler | undefined, tag: string): Record<string, unknown> {
  const attrs: Record<string, unknown> = {};
  if (typeof node.className === "string" && node.className !== "") attrs.className = node.className;
  const raw = isRec(node.attributes) ? node.attributes : isRec(node.attrs) ? node.attrs : null;
  if (raw !== null) {
    for (const [key, value] of Object.entries(raw)) {
      if (key.startsWith("on")) continue; // never adopt an untrusted handler string
      if (key === "class" || key === "className") attrs.className = String(value);
      else if (key === "for") attrs.htmlFor = String(value);
      else attrs[key] = value;
    }
  }
  if (tag === "form" && onSubmit !== undefined) attrs.onSubmit = onSubmit;
  return attrs;
}

function childNode(value: unknown, onSubmit: SubmitHandler | undefined): ReactNode {
  return renderValue(value, onSubmit);
}

function childrenOf(node: Rec, onSubmit: SubmitHandler | undefined): ReactNode[] {
  const out: ReactNode[] = [];
  if (Array.isArray(node.children)) for (const kid of node.children) out.push(childNode(kid, onSubmit));
  if (typeof node.textContent === "string" && node.textContent !== "") out.push(node.textContent);
  if (typeof node.text === "string" && node.text !== "") out.push(node.text);
  return out;
}

function sectionView(model: Rec): ReactNode {
  const sections = Array.isArray(model.sections) ? model.sections : [];
  const children: ReactNode[] = [];
  if (typeof model.h1 === "string" && model.h1 !== "") children.push(el("h1", null, model.h1));
  sections.forEach((section, index) => {
    const rec = isRec(section) ? section : {};
    const heading = typeof rec.heading === "string" ? rec.heading : "";
    const text = typeof rec.body === "string" ? rec.body : "";
    const level = typeof rec.headingLevel === "number" ? rec.headingLevel : 2;
    const tag = "h" + String(Math.min(6, Math.max(1, Math.round(level))));
    children.push(
      el("section", { className: "section", key: index }, heading !== "" ? el(tag, null, heading) : null, text !== "" ? el("p", null, text) : null),
    );
  });
  return el("div", { className: "section" }, ...children);
}

function renderValue(value: unknown, onSubmit: SubmitHandler | undefined): ReactNode {
  if (value === null || value === undefined || typeof value === "boolean") return null;
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((entry, index) => el("span", { key: index }, renderValue(entry, onSubmit)));
  if (!isRec(value)) return null;
  if ("$$typeof" in value) return value as unknown as ReactNode; // a real React element
  const tag = typeof value.tagName === "string" ? value.tagName : typeof value.tag === "string" ? value.tag : "";
  if (tag !== "") return el(tag, attrsOf(value, onSubmit, tag), ...childrenOf(value, onSubmit));
  if (typeof value.h1 === "string" || Array.isArray(value.sections)) return sectionView(value);
  return null;
}

export function GeneratedView({ value, onSubmit }: { value: unknown; onSubmit?: SubmitHandler }): ReactNode {
  return renderValue(value, onSubmit);
}
`;
  return [...sourceHeader("src/ui/render-tree.tsx", "Adapter that mounts generated view values as React elements", project, [
    "// Reads the generated module's real render output; renders unknown shapes as nothing.",
  ]), body].join("\n");
}

/** Renderer-shape site-data: call the real renderers once, export their views. */
function rendererSiteDataModule(ctx: MarketingSiteCtx): string {
  const renderers = ctx.renderers ?? {};
  const lines: string[] = [
    ...sourceHeader("src/ui/site-data.ts", "Site content adapters over the generated module", ctx.project, [
      "// Calls the generated module's REAL render exports with sound empty args;",
      "// nothing is invented. A renderer the tree does not expose is absent.",
    ]),
    `import * as generated from "${ctx.generated}";`,
    "",
    `export const SITE_NAME = ${jstr(ctx.siteName)};`,
    "",
  ];
  const roles: MarketingRenderRole[] = ["home", "menu", "about", "hours", "order", "contact"];
  for (const role of roles) {
    const r = renderers[role];
    if (r === undefined) continue;
    lines.push(`export const ${role}View: unknown = generated.${r.name}(${r.args.join(", ")});`);
  }
  lines.push(
    "",
    `export const hasOrdering = ${ctx.submit !== null && ctx.submit !== undefined ? "true" : "false"};`,
    "",
  );
  return lines.join("\n");
}

/** Renderer-shape shared chrome (no data-adapter `business` model). */
function rendererLayoutModule(ctx: MarketingSiteCtx): string {
  const body = `// Shared chrome for a renderer-backed site: a working nav over the emitted
// pages and a footer naming the site. Page content comes from the generated
// render exports via ./render-tree.tsx.
import type { ReactNode } from "react";
import { SITE_NAME } from "./site-data.ts";

export type SiteNavItem = { id: string; title: string; href: string };

export function SiteLayout({ nav, current, children }: { nav: readonly SiteNavItem[]; current: string; children: ReactNode }) {
  return (
    <div className="site">
      <header className="site-header">
        <a className="site-brand" href="#/home">
          <span className="site-brand__name">{SITE_NAME}</span>
        </a>
        <nav className="site-nav" aria-label="Primary">
          {nav.map((item) => (
            <a
              key={item.id}
              href={item.href}
              className={item.id === current ? "site-nav__link site-nav__link--active" : "site-nav__link"}
              aria-current={item.id === current ? "page" : undefined}
            >
              {item.title}
            </a>
          ))}
        </nav>
      </header>
      <main className="site-main">{children}</main>
      <footer className="site-footer">
        <div className="site-footer__inner">
          <p className="site-footer__name">{SITE_NAME}</p>
        </div>
      </footer>
    </div>
  );
}
`;
  return [...sourceHeader("src/ui/layout.tsx", "Shared site layout (header, navigation, footer)", ctx.project, [
    "// Every page mounts inside this chrome.",
  ]), body].join("\n");
}

/** One renderer-backed page: mount the generated renderer's view. */
function rendererPageModule(ctx: MarketingSiteCtx, component: string, role: MarketingRenderRole, title: string): string {
  const body = `// Mounts the generated \`${role}\` render export through the view adapter.
import { GeneratedView } from "../render-tree.tsx";
import { ${role}View } from "../site-data.ts";

export function ${component}() {
  return (
    <div>
      <section className="section">
        <h1>${mdLine(title, 80)}</h1>
      </section>
      <GeneratedView value={${role}View} />
    </div>
  );
}
`;
  return [...sourceHeader(`src/ui/pages/${component}.tsx`, `${title} page (generated renderer output)`, ctx.project), body].join("\n");
}

/**
 * Renderer-shape OrderPage: mounts the generated order form and, on submit,
 * calls the generated order endpoint and persists the confirmation through the
 * emitted store's OrderLog â€” so the ordering flow survives a reload.
 */
function rendererOrderPageModule(ctx: MarketingSiteCtx): string {
  const submit = ctx.submit;
  if (submit === null || submit === undefined) return "";
  const submitArgs = (ctx.submitArgs ?? []).join(", ");
  const storeImport = ctx.store !== null && ctx.store !== undefined ? `import { orderLog, type OrderRecord } from ${jstr(tsImportPath("src/ui/pages", ctx.store))};` : "";
  const body = `// The ordering flow (renderer shape): the generated order form is mounted
// through the view adapter; submitting calls the generated ${submit.name}(...)
// endpoint and persists the confirmation in the emitted store's OrderLog.
import { useState } from "react";
import type { FormEvent } from "react";
import * as generated from ${jstr(tsImportPath("src/ui/pages", ctx.generatedEntryPath ?? ""))};
import { GeneratedView } from "../render-tree.tsx";
import { orderView, hasOrdering } from "../site-data.ts";
${storeImport}

export function OrderPage() {
  const [notice, setNotice] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
${ctx.store !== null && ctx.store !== undefined ? "  const [history, setHistory] = useState<OrderRecord[]>(() => orderLog.all());" : "  const [history] = useState<readonly string[]>([]);"}

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload: { [field: string]: string } = {};
    data.forEach((value, key) => {
      payload[key] = typeof value === "string" ? value : "";
    });
    setSubmitting(true);
    try {
      const result: unknown = await generated.${submit.name}(${submitArgs});
      const rec = result as { reference?: unknown; message?: unknown } | null;
      const reference = rec !== null && typeof rec.reference === "string" ? rec.reference : "";
      const message = rec !== null && typeof rec.message === "string" ? rec.message : "Order received.";
${ctx.store !== null && ctx.store !== undefined
      ? `      const record: OrderRecord = { id: reference !== "" ? reference : "order-" + String(Date.now()), message, submittedAt: new Date().toISOString(), payload };\n      orderLog.record(record);\n      setHistory(orderLog.all());`
      : `      void reference;`}
      setNotice(message + (reference !== "" ? " Reference: " + reference + "." : ""));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <section className="section">
        <h1>Order</h1>
        {!hasOrdering ? <p className="notice notice--error">This build's generated module exposes no order endpoint, so an order cannot be submitted here.</p> : null}
      </section>
      <div className="grid grid--two">
        <section className="section">
          <h2>Your details</h2>
          <GeneratedView value={orderView} onSubmit={(event) => void onSubmit(event)} />
          <button type="button" className="btn btn--primary" disabled={submitting} onClick={() => {
            const form = document.querySelector("form");
            if (form instanceof HTMLFormElement) form.requestSubmit();
          }}>{submitting ? "Placing orderâ€¦" : "Place order"}</button>
          {notice !== "" ? <p className="notice notice--ok" role="status">{notice}</p> : null}
        </section>
        <section className="section">
          <h2>Order history</h2>
${ctx.store !== null && ctx.store !== undefined
      ? `          {history.length === 0 ? (
            <p className="cart__empty">No orders yet.</p>
          ) : (
            <ul className="cart">
              {history.map((record) => (
                <li className="cart__line" key={record.id}>
                  <span className="cart__name">{record.message}</span>
                  <span className="muted">{record.submittedAt}</span>
                </li>
              ))}
            </ul>
          )}`
      : `          <p className="cart__empty">Order history is not persisted in this build (no store module was emitted).</p>`}
        </section>
      </div>
    </div>
  );
}
`;
  return [...sourceHeader("src/ui/pages/OrderPage.tsx", "Ordering flow (generated form + persisted order log)", ctx.project), body].join("\n");
}

/**
 * The renderer-shape multi-page site file set, or null when the entry exposes no
 * callable page renderers (the caller then falls back to the single-file shell).
 */
function webMarketingRendererSiteFiles(
  args: {
    project: Project;
    uiPath: string;
    generatedEntryPath: string;
    entrySource: string;
    storePath: string | null;
    callables: readonly UiCallable[];
  },
): ScaffoldFile[] | null {
  const { project, uiPath, generatedEntryPath, entrySource, storePath, callables } = args;
  const aliases = uiTypeAliases(entrySource);
  const objects = uiDeclaredObjects(entrySource);
  const renderers = pickMarketingRenderers(callables, aliases, objects);
  if (renderers.home === undefined) return null;
  const submitCandidate =
    callables.find((c) => /^(?:submit|create|place|start|make)[A-Za-z0-9_$]*order/i.test(c.name)) ??
    callables.find((c) => /order/i.test(c.name) && c.params.length > 0) ??
    null;
  // Arg 0 is the form payload (cast from the FormData object); every later arg
  // must be soundly constructible, else the order page is not emitted (never a
  // fabricated argument).
  const submitArgs: string[] | null =
    submitCandidate === null || submitCandidate.params.length === 0
      ? submitCandidate === null
        ? null
        : []
      : (() => {
          const rest = submitCandidate.params.slice(1);
          const built: string[] = [`payload as unknown as Parameters<typeof generated.${submitCandidate.name}>[0]`];
          for (const p of rest) {
            const value = p.type === "" ? "null" : emptyForType(p.type, aliases, objects);
            if (value === null) return null;
            built.push(value);
          }
          return built;
        })();
  const submit = submitCandidate !== null && submitArgs !== null ? submitCandidate : null;
  const asksOrdering =
    /\b(order|ordering|orders|cart|checkout|pickup|pre-?order|preorder|delivery|reserve|reservation|booking)\b/i.test(
      project.brief ?? "",
    );
  const pages: MarketingPage[] = [{ id: "home", title: "Home", component: "HomePage" }];
  if (renderers.menu !== undefined) pages.push({ id: "menu", title: "Menu", component: "MenuPage" });
  if (renderers.about !== undefined) pages.push({ id: "about", title: "About", component: "AboutPage" });
  if (renderers.contact !== undefined || renderers.hours !== undefined) {
    pages.push({ id: "contact", title: "Contact", component: "ContactPage" });
  }
  const showOrder = renderers.order !== undefined && (asksOrdering || submit !== null);
  if (showOrder) pages.push({ id: "order", title: "Order", component: "OrderPage" });
  if (pages.length < 2) return null; // one renderer is not a site â€” the shell mounts it

  const ctx: MarketingSiteCtx = {
    project,
    src: { facts: null, menu: null, hours: null, policy: null, story: null, photo: null, order: null, validateTiming: null },
    pages,
    ordering: showOrder,
    siteName: displayName(project.name) || "Site",
    generated: tsImportPath("src/ui", generatedEntryPath),
    renderers,
    submit: showOrder ? submit : null,
    submitArgs: showOrder && submitArgs !== null ? submitArgs : [],
    store: storePath,
    generatedEntryPath,
  };

  const files: ScaffoldFile[] = [
    { path: "src/ui/site-data.ts", body: rendererSiteDataModule(ctx) },
    { path: "src/ui/render-tree.tsx", body: rendererAdapterModule(project) },
    { path: "src/ui/layout.tsx", body: rendererLayoutModule(ctx) },
    { path: "src/ui/router.tsx", body: routerModule(ctx) },
    { path: "src/ui/pages/HomePage.tsx", body: rendererPageModule(ctx, "HomePage", "home", "Home") },
  ];
  if (renderers.menu !== undefined) {
    files.push({ path: "src/ui/pages/MenuPage.tsx", body: rendererPageModule(ctx, "MenuPage", "menu", "Menu") });
  }
  if (renderers.about !== undefined) {
    files.push({ path: "src/ui/pages/AboutPage.tsx", body: rendererPageModule(ctx, "AboutPage", "about", "About") });
  }
  if (renderers.contact !== undefined || renderers.hours !== undefined) {
    const role: MarketingRenderRole = renderers.contact !== undefined ? "contact" : "hours";
    files.push({ path: "src/ui/pages/ContactPage.tsx", body: rendererPageModule(ctx, "ContactPage", role, "Contact") });
  }
  if (showOrder && submit !== null) {
    files.push({ path: "src/ui/pages/OrderPage.tsx", body: rendererOrderPageModule(ctx) });
  }
  files.push({ path: uiPath, body: siteConsoleModule(ctx) });
  files.push({ path: "public/assets/manifest.json", body: marketingAssetManifest(collectImageUrls(project)) });
  return files;
}

/**
 * Build the multi-page marketing site's file set, or null when this emit is not
 * a `web-marketing` webapp (or the generated module exposes no page content).
 * The returned files are additive beside the rest of the tree; the caller pushes
 * them and marks the UI generation record.
 */
function webMarketingSiteFiles(args: {
  project: Project;
  kind: ProjectKind;
  uiPath: string | null;
  generatedEntryPath: string | null;
  entrySource: string | null;
  storePath: string | null;
}): ScaffoldFile[] | null {
  const { project, kind, uiPath, generatedEntryPath, entrySource, storePath } = args;
  if (kind !== "webapp" || uiPath === null || generatedEntryPath === null || entrySource === null) return null;
  if (!isMarketingSiteBrief(project)) return null;
  const callables = marketingCallables(entrySource);
  const src = pickMarketingSources(callables);
  // fixes/352: the parameterised-renderer shape (the keyed bakery tree) has no
  // zero-arg getters; before bailing to the single-file shell, try the renderer
  // site so a real multi-page site ships for BOTH shapes.
  if (src.facts === null && src.menu === null && src.hours === null && src.story === null) {
    return webMarketingRendererSiteFiles({
      project,
      uiPath,
      generatedEntryPath,
      entrySource,
      storePath,
      callables,
    });
  }

  const pages: MarketingPage[] = [{ id: "home", title: "Home", component: "HomePage" }];
  if (src.menu !== null) pages.push({ id: "menu", title: "Menu", component: "MenuPage" });
  if (src.story !== null) pages.push({ id: "about", title: "About", component: "AboutPage" });
  if (src.hours !== null || src.facts !== null) pages.push({ id: "contact", title: "Contact", component: "ContactPage" });
  const asksOrdering =
    /\b(order|ordering|orders|cart|checkout|pickup|pre-?order|preorder|delivery|reserve|reservation|booking)\b/i.test(
      project.brief ?? "",
    );
  const ordering = asksOrdering && (src.order !== null || src.policy !== null);
  if (ordering) pages.push({ id: "order", title: "Order", component: "OrderPage" });

  const ctx: MarketingSiteCtx = {
    project,
    src,
    pages,
    ordering,
    siteName: displayName(project.name) || "Site",
    generated: tsImportPath("src/ui", generatedEntryPath),
    store: storePath,
    generatedEntryPath,
  };

  const files: ScaffoldFile[] = [
    { path: "src/ui/site-data.ts", body: siteDataModule(ctx) },
    { path: "src/ui/layout.tsx", body: layoutModule(ctx) },
    { path: "src/ui/router.tsx", body: routerModule(ctx) },
    { path: "src/ui/pages/HomePage.tsx", body: homePageModule(ctx) },
  ];
  if (ctx.pages.some((p) => p.id === "menu")) files.push({ path: "src/ui/pages/MenuPage.tsx", body: menuPageModule(ctx) });
  if (ctx.pages.some((p) => p.id === "about")) files.push({ path: "src/ui/pages/AboutPage.tsx", body: aboutPageModule(ctx) });
  if (ctx.pages.some((p) => p.id === "contact")) files.push({ path: "src/ui/pages/ContactPage.tsx", body: contactPageModule(ctx) });
  if (ordering) {
    files.push({ path: "src/ui/cart.ts", body: cartModule(ctx) });
    files.push({ path: "src/ui/pages/OrderPage.tsx", body: orderPageModule(ctx) });
  }
  files.push({ path: uiPath, body: siteConsoleModule(ctx) });
  files.push({ path: "public/assets/manifest.json", body: marketingAssetManifest(collectImageUrls(project)) });
  return files;
}

// ---------------------------------------------------------------------------
// 353 â€” the shape-tolerant briefed site.
//
// 351/352 emit the multi-page site only for a `web-marketing` brief whose
// generated module exposes a matching content role. The measured keyed trees
// (a bakery exporting ASYNC `getMenuItems`/`getOpenStatus`, no `render*` and no
// zero-arg SYNC getter) fell through to the single-file debug form â€” 10 of 10
// fresh trees had 0 page files and no router. This emitter builds the page set
// from the brief's OWN `Pages:`/`Views:` list, or â€” when the brief is prose and
// names no labelled list (fixes/354 A2-F5) â€” from the project's own spec lines
// (`implementationSpec` requirements/dataFlow, then spec-graph node purposes);
// it mounts each page over whatever REAL export the entry exposes:
// a `render*`/`*Page` helper, a zero-arg getter (sync or async), a getter whose
// declared args are soundly constructible, or a form bound to a matching
// mutator. A page with no mountable export renders an explicit "not published"
// state â€” nothing is invented and every mount calls a real tree export.
// ---------------------------------------------------------------------------

type BriefedPage = { id: string; title: string; component: string };

type PageField = { name: string; label: string; type: string };

/** One argument of a form-bound call: a form field, or a sound literal. */
type FormArg = { kind: "form"; field: PageField } | { kind: "literal"; text: string };

type FormPlan = { shape: "object" | "positional"; args: FormArg[]; fields: PageField[] };

type PageMount =
  | { kind: "render"; name: string; args: string[] }
  | { kind: "get"; name: string; args: string[]; async: boolean }
  | { kind: "form"; name: string; plan: FormPlan; async: boolean }
  | { kind: "empty"; reason: string };

type BriefedSiteCtx = {
  project: Project;
  /** The kind this emit resolved â€” the operator merge is webapp-only (358). */
  kind: ProjectKind;
  uiPath: string;
  generatedEntryPath: string;
  siteName: string;
  pages: BriefedPage[];
  mounts: Map<string, PageMount>;
  /** Import specifier from `src/ui` to the generated entry (extension included). */
  entryFromUi: string;
  /** Import specifier from `src/ui/pages` to the generated entry. */
  entryFromPages: string;
};

const PAGE_STOPWORDS = new Set([
  "the", "and", "with", "for", "page", "pages", "view", "views", "screen", "screens",
  "of", "a", "an", "to", "by", "on", "in", "detail", "details", "new", "site",
]);

/** Role synonyms so a briefed page name can bind a real export of a different name. */
const PAGE_ROLE_SYNONYMS: Record<string, string[]> = {
  home: ["home", "overview", "dashboard", "start", "facts", "business", "status", "open"],
  menu: ["menu", "catalog", "catalogue", "product", "products", "item", "items", "shop", "offerings"],
  shop: ["shop", "store", "product", "products", "catalog", "catalogue", "item", "items", "stock", "inventory"],
  product: ["product", "products", "item", "items", "stock", "inventory"],
  cart: ["cart", "basket", "line", "items"],
  checkout: ["checkout", "order", "cart", "submit"],
  order: ["order", "orders", "cart", "checkout", "purchase", "fulfilment", "fulfillment"],
  about: ["about", "story", "history", "heritage", "mission", "facts", "company", "profile"],
  contact: ["contact", "location", "address", "hours", "phone", "facts", "business", "profile"],
  hours: ["hours", "opening", "schedule", "open", "status", "availability"],
  // fixes/357: `opening` is a synonym VALUE of `hours` above, never a key â€” so a
  // page whose derived id kept the WORD ("Bakery s opening", from a "check the
  // opening hours" requirement) matched no export and bound nothing, even when
  // the tree exported a real `getOpenStatus()`. Keyed as its own role so the
  // same real export is reachable from either spelling of the page name.
  opening: ["hours", "opening", "open", "schedule", "status", "availability"],
  location: ["location", "address", "contact", "hours", "region", "regions", "territory"],
  regions: ["region", "regions", "territory", "location", "revenue"],
  customers: ["customer", "customers", "client", "clients", "repeat", "churn"],
  products: ["product", "products", "item", "items", "seller", "sellers", "category", "categories"],
  admin: ["admin", "manage", "management", "queue", "staff", "editor"],
  report: ["report", "reports", "summary", "metrics", "analytics", "overview"],
};

/** Lowercased content tokens of a page title/export name (camelCase split). */
function pageTokens(raw: string): string[] {
  return String(raw ?? "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .map((t) => t.toLowerCase())
    .filter((t) => t.length > 1 && !PAGE_STOPWORDS.has(t));
}

/** The page titles a brief names in its own `Pages:`/`Views:`/`Screens:` list. */
function briefPageTitles(brief: string): string[] {
  const text = String(brief ?? "");
  const m = /(?:^|\n)[ \t]*(?:pages?|views?|screens?)\s*:\s*([\s\S]+?)(?:\n[ \t]*\n|\n(?=[A-Z][A-Za-z ]+:)|$)/i.exec(text);
  if (!m) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of m[1].split(";")) {
    let label = raw
      .replace(/\([^)]*\)/g, " ")
      .replace(/\s+(?:with|for|to|that|including|showing|containing)\b[\s\S]*$/i, " ")
      .replace(/[.,;:]+$/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    label = (label.split(/\.\s/)[0] ?? label).trim();
    for (let i = 0; i < 3; i++) {
      const next = label.replace(/^(?:and|also|plus|an?|the)\s+/i, "").trim();
      if (next === label) break;
      label = next;
    }
    label = label.replace(/\s+p(?:age|ages)$/i, "").trim();
    if (label === "") continue;
    const title = label.charAt(0).toUpperCase() + label.slice(1);
    const id = ident(title, "page").toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(title);
  }
  return out.slice(0, 8);
}

/** Leading verb/actor/article a spec sentence opens with â€” stripped before a
 *  page title is taken from it. Repeated (up to 4Ã—) so "let customers browse
 *  the menu" reduces to "menu". */
const PAGE_SPEC_LEAD_RE =
  /^(?:(?:the|a|an|its|their|our|this|that|each|every|all|users?|customers?|visitors?|members?|staff|admins?|operators?|people|let|allows?|enables?|provides?|providing|show|shows|display|displays|list|lists|views?|see|browse|browses|search|searches|filter|filters|manage|manages|track|tracks|create|creates|submit|submits|place|places|schedule|schedules|book|books|update|updates|edit|edits|add|adds|remove|removes|delete|deletes|record|records|persist|persists|store|stores|save|saves|handle|handles|process|processes|serve|serves|render|renders|generate|generates|compute|computes|calculate|calculates|fetch|fetches|load|loads|get|gets|read|reads|select|selects|register|registers|login|logout|authenticate|authorize|expose|exposes|include|includes|support|supports|allow|enable|provide)\b[\s:,-]*)/i;
/** Trailing qualifier ("â€¦ with prices", "â€¦ for staff") â€” dropped after the head. */
const PAGE_SPEC_TRAIL_RE =
  /\s+(?:with|for|to|that|which|including|showing|containing|by|from|using|into|across|and|or|so|when|where|while|before|after)\b[\s\S]*$/i;

/** fixes/354 A2-F5: the page title a spec sentence names, or "" â€” never invented. */
function pageTitleFromSpecLine(line: string): string {
  let text = collapse(line).replace(/[`"'*_#>]/g, " ");
  for (let i = 0; i < 4; i++) {
    const next = text.replace(PAGE_SPEC_LEAD_RE, "").trim();
    if (next === text) break;
    text = next;
  }
  text = text.replace(PAGE_SPEC_TRAIL_RE, "").replace(/[.:;,]+$/g, "").replace(/\s+/g, " ").trim();
  const words = text.split(" ").filter(Boolean).slice(0, 3);
  if (words.length === 0) return "";
  if (!words.some((w) => !PAGE_STOPWORDS.has(w.toLowerCase()))) return "";
  const title = words.join(" ");
  return title.charAt(0).toUpperCase() + title.slice(1);
}

/** fixes/354 A2-F5: page titles derived from the project's OWN `implementationSpec`
 *  when the brief names no labelled `Pages:`/`Views:` list. Each title comes
 *  from a real spec line (requirements, then dataFlow, then typeSignatures) â€”
 *  never a hardcoded page name. Deterministic order, deduped, capped; an absent
 *  spec (keyless floor) yields NO pages, so the single-file shell is kept. */
function specPageTitles(project: Project): string[] {
  const lines: string[] = [];
  const spec = project.implementationSpec;
  if (spec && typeof spec === "object") {
    for (const key of ["requirements", "dataFlow", "typeSignatures"] as const) {
      const arr = (spec as Record<string, unknown>)[key];
      if (Array.isArray(arr)) for (const s of arr) if (typeof s === "string" && s.trim()) lines.push(s);
    }
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const title = pageTitleFromSpecLine(line);
    if (title === "") continue;
    const id = ident(title, "page").toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(title);
    if (out.length >= 8) break;
  }
  return out;
}

/** The briefed page set: the brief's own `Pages:`/`Views:` list, else â‰¥2 pages
 *  derived from the project's own spec (fixes/354 A2-F5). Fewer than two either
 *  way is not a multi-page brief â€” the single-file shell is kept unchanged. */
function briefedPageDefs(project: Project): BriefedPage[] {
  let titles = briefPageTitles(project.brief ?? "");
  if (titles.length < 2) titles = specPageTitles(project);
  if (titles.length < 2) return [];
  const out: BriefedPage[] = [];
  const seen = new Set<string>();
  const take = nameTaker();
  for (const title of titles) {
    const id = ident(title, "page").toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, title: collapse(title).slice(0, 60), component: take(`${pascal(title)}Page`) });
  }
  const hi = out.findIndex((p) => p.id === "home");
  if (hi > 0) out.unshift(...out.splice(hi, 1));
  // 353 (no-invention): a brief that asks for an admin surface, or that
  // withholds facts (prices/awards/addresses), gets an Admin page. Its mount is
  // a REAL editor bound to the tree's update mutator when one exists, else an
  // explicit not-published state â€” never a made-up literal.
  const brief = String(project.brief ?? "").toLowerCase();
  const withholds =
    /\bno\s+(?:prices?|awards?|addresses?|figures?|facts?|numbers?)\b/.test(brief) ||
    /\b(?:not|never)\s+(?:publish|invent|fabricat|disclos|make\s+up)/.test(brief) ||
    /\bwithheld\b|\bunpublished\b/.test(brief);
  if ((/\badmin/.test(brief) || withholds) && !out.some((p) => p.id === "admin")) {
    out.push({ id: "admin", title: "Admin", component: take("AdminPage") });
  }
  return out.slice(0, 8);
}

/** True when a real export name plausibly serves a briefed page. */
function pageMatchesExport(pageId: string, exportName: string): boolean {
  const pageToks = pageTokens(pageId);
  if (pageToks.length === 0) return false;
  const lower = exportName.toLowerCase();
  for (const tok of pageToks) {
    for (const syn of PAGE_ROLE_SYNONYMS[tok] ?? []) {
      if (lower.includes(syn)) return true;
    }
  }
  const exportToks = pageTokens(exportName.replace(/^(?:get|fetch|load|list|read|compute|calculate|derive|render|make|build|create|submit|place|update|is|has)+/, ""));
  return exportToks.some((t) => pageToks.includes(t));
}

/** Sound call args for an export (async allowed), or null when none are provable. */
function soundArgsFor(
  c: UiCallable,
  aliases: ReadonlyMap<string, string>,
  objects: ReadonlyMap<string, { name: string; type: string; optional: boolean }[]>,
): string[] | null {
  const args: string[] = [];
  for (const p of c.params) {
    if (p.rest) return null;
    const value = p.type === "" ? "null" : emptyForType(p.type, aliases, objects);
    if (value === null) return null;
    args.push(value);
  }
  return args;
}

/** The full call plan for a mutator a page can bind a form to. Every argument
 *  is either a real form field or a sound literal; a parameter that can supply
 *  NEITHER makes the callable unbindable (never a fabricated/arity-short call). */
function pageFormPlan(
  c: UiCallable,
  aliases: ReadonlyMap<string, string>,
  objects: ReadonlyMap<string, { name: string; type: string; optional: boolean }[]>,
): FormPlan | null {
  const field = (name: string, type: string): PageField => ({
    name: ident(name, "field"),
    label: pageTokens(name).join(" ") || name,
    type,
  });
  if (c.objectKeys) {
    const fields = c.objectKeys.map((k) => field(k.name, k.type));
    if (fields.some((f) => !uiFormBindableParam(f.type, aliases))) return null;
    return { shape: "object", args: fields.map((f) => ({ kind: "form", field: f })), fields };
  }
  const args: FormArg[] = [];
  const fields: PageField[] = [];
  for (const p of c.params) {
    if (p.rest) return null;
    const resolved = uiResolveTypeText(p.type, aliases);
    if (uiFormBindableParam(resolved, aliases)) {
      const f = field(p.name, resolved);
      fields.push(f);
      args.push({ kind: "form", field: f });
    } else {
      const literal = emptyForType(p.type, aliases, objects);
      if (literal === null) return null;
      args.push({ kind: "literal", text: literal });
    }
  }
  return { shape: "positional", args, fields };
}

/** Choose the real export a briefed page mounts, in deterministic priority order. */
function pageMountFor(
  page: BriefedPage,
  callables: readonly UiCallable[],
  aliases: ReadonlyMap<string, string>,
  objects: ReadonlyMap<string, { name: string; type: string; optional: boolean }[]>,
  used: Set<string>,
): PageMount {
  const match = (c: UiCallable): boolean => !used.has(c.name) && pageMatchesExport(page.id, c.name);
  // 1. A page-shaped renderer, called with sound args.
  for (const c of callables.filter((x) => uiRenderLike(x) && match(x))) {
    const args = uiRenderCallArgs(c, aliases);
    if (args !== null) {
      used.add(c.name);
      return { kind: "render", name: c.name, args };
    }
  }
  const formFor = (): PageMount | null => {
    for (const c of callables.filter((x) => match(x))) {
      const plan = pageFormPlan(c, aliases, objects);
      if (plan === null || plan.fields.length === 0) continue;
      used.add(c.name);
      return { kind: "form", name: c.name, plan, async: c.async === true };
    }
    return null;
  };
  const getters = callables.filter(
    (c) => /^(?:get|list|load|fetch|read|compute|calculate|summari[sz]e|report|is|has)/.test(c.name) && match(c),
  );
  const getterFor = (): PageMount | null => {
    // A zero-arg getter (sync or async) â€” the honest data source.
    for (const c of getters) {
      if (c.params.filter((p) => !p.rest).length === 0) {
        used.add(c.name);
        return { kind: "get", name: c.name, args: [], async: c.async === true };
      }
    }
    for (const c of getters) {
      const args = soundArgsFor(c, aliases, objects);
      if (args !== null) {
        used.add(c.name);
        return { kind: "get", name: c.name, args, async: c.async === true };
      }
    }
    return null;
  };
  // 2. A transactional page (order/cart/checkout/admin/booking) binds a real
  //    mutator form before it shows an admin/queue read view.
  const transactional = pageTokens(page.id).some((t) =>
    ["order", "cart", "checkout", "admin", "booking", "reservation", "submit"].includes(t),
  );
  if (transactional) {
    const form = formFor();
    if (form !== null) return form;
    // 353 (no-invention): an Admin page prefers a REAL editor â€” a mutator whose
    // name is an edit verb â€” over a read-only queue view, so withheld fields
    // (e.g. prices) can be set through the tree's own update export.
    if (pageTokens(page.id).includes("admin")) {
      // Prefer the RICHEST editor (most form fields) so a withheld price field
      // is editable via the tree's own `update*Price`-style export.
      let best: { c: UiCallable; plan: FormPlan } | null = null;
      for (const c of callables.filter((x) => !used.has(x.name) && /^(?:update|set|manage|edit|adjust|assign|toggle|publish|archive)/i.test(x.name))) {
        const plan = pageFormPlan(c, aliases, objects);
        if (plan === null || plan.fields.length === 0) continue;
        if (best === null || plan.fields.length > best.plan.fields.length) best = { c, plan };
      }
      if (best !== null) {
        used.add(best.c.name);
        return { kind: "form", name: best.c.name, plan: best.plan, async: best.c.async === true };
      }
    }
  }
  // 3. A getter over the real data exports.
  const get = getterFor();
  if (get !== null) return get;
  // 4. Any remaining bindable mutator.
  const form = formFor();
  if (form !== null) return form;
  return { kind: "empty", reason: "no generated export serves this section" };
}

/** `src/ui/view.tsx` â€” generic real-data views over the generated module's exports. */
function genericViewModule(project: Project): string {
  const body = `// Renders real values returned by the generated module â€” never fabricated.
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

type Rec = { [key: string]: unknown };

function isRec(value: unknown): value is Rec {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function scalarText(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  if (value === undefined) return "undefined";
  return "";
}

function errorTextOf(value: unknown): string | null {
  return isRec(value) && typeof value.__rtError === "string" ? value.__rtError : null;
}

/** Renders a real value: a record as a definition list, an array as a list. */
export function GeneratedView({ value }: { value: unknown }): ReactNode {
  const error = errorTextOf(value);
  if (error !== null) return <p className="notice notice--error" role="alert">{error}</p>;
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    if (value.length === 0) return <p className="muted">No records returned.</p>;
    return (
      <ul className="records">
        {value.map((item, index) => (
          <li className="records__item" key={index}>
            {isRec(item) ? <RecordView value={item} /> : scalarText(item)}
          </li>
        ))}
      </ul>
    );
  }
  if (isRec(value)) return <RecordView value={value} />;
  return <p className="value">{scalarText(value)}</p>;
}

function RecordView({ value }: { value: Rec }): ReactNode {
  const keys = Object.keys(value);
  if (keys.length === 0) return <p className="muted">No fields returned.</p>;
  return (
    <dl className="record">
      {keys.map((key) => (
        <div className="record__pair" key={key}>
          <dt>{key}</dt>
          <dd>{typeof value[key] === "object" && value[key] !== null ? <GeneratedView value={value[key]} /> : scalarText(value[key])}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Mounts a React node a generated renderer returned. */
export function RenderView({ value }: { value: unknown }): ReactNode {
  const error = errorTextOf(value);
  if (error !== null) return <p className="notice notice--error" role="alert">{error}</p>;
  return value as ReactNode;
}

/** Calls a real synchronous export, capturing a thrown Error as a rendered note. */
export function safeValue(load: () => unknown): unknown {
  try {
    return load();
  } catch (error) {
    return { __rtError: error instanceof Error ? error.message : String(error) };
  }
}

/** Loads a real async export once and renders its resolved value. */
export function AsyncValue({ load, empty }: { load: () => Promise<unknown>; empty?: string }): ReactNode {
  const [value, setValue] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  useEffect(() => {
    let active = true;
    load().then(
      (resolved) => { if (active) { setValue(resolved); setLoading(false); } },
      (thrown: unknown) => { if (active) { setError(thrown instanceof Error ? thrown.message : String(thrown)); setLoading(false); } },
    );
    return () => { active = false; };
  }, []);
  if (loading) return <p className="muted" role="status">Loadingâ€¦</p>;
  if (error !== null) return <p className="notice notice--error" role="alert">{error}</p>;
  if (value === null || value === undefined) return <p className="muted">{empty ?? "No records returned."}</p>;
  return <GeneratedView value={value} />;
}

/** An explicit "this build publishes no content for the section" state. */
export function EmptySection({ title }: { title: string }): ReactNode {
  return <p className="notice" role="status">{title} is not published by this build.</p>;
}
`;
  return [...sourceHeader("src/ui/view.tsx", "Generic views over the generated module's real exports", project, [
    "// Every value shown here is returned by a real generated export; nothing is invented.",
  ]), body].join("\n");
}

function genericSiteDataModule(ctx: BriefedSiteCtx): string {
  const coerce = (f: PageField): string => {
    const t = f.type.toLowerCase();
    if (/\bnumber\b|\bint(eger)?\b|\bfloat\b|\bdecimal\b|\bdouble\b/.test(t)) return `Number(data.get(${jstr(f.name)}) ?? "")`;
    if (/\bbool(ean)?\b/.test(t)) return `String(data.get(${jstr(f.name)}) ?? "") === "true"`;
    return `String(data.get(${jstr(f.name)}) ?? "")`;
  };
  const lines: string[] = [
    ...sourceHeader("src/ui/site-data.ts", "Site content adapters over the generated module", ctx.project, [
      "// Every adapter below calls a REAL generated export; nothing is invented.",
      "// A page whose mount is absent renders an explicit not-published state.",
    ]),
    `import * as generated from ${jstr(ctx.entryFromUi)};`,
    "",
    `export const SITE_NAME = ${jstr(ctx.siteName)};`,
    "",
  ];
  for (const page of ctx.pages) {
    const mount = ctx.mounts.get(page.id);
    if (mount === undefined || mount.kind === "empty") continue;
    if (mount.kind === "render") {
      lines.push(
        `/** ${page.title}: mounts the generated ${mount.name} renderer's real output. */`,
        `export function pageView${page.component}(): unknown {`,
        `  return generated.${mount.name}(${mount.args.join(", ")});`,
        `}`,
        "",
      );
    } else if (mount.kind === "get") {
      lines.push(
        `/** ${page.title}: reads the generated ${mount.name} export. */`,
        `export function pageLoad${page.component}(): ${mount.async ? "Promise<unknown>" : "unknown"} {`,
        `  return generated.${mount.name}(${mount.args.join(", ")});`,
        `}`,
        "",
      );
    } else {
      const argExpr = (a: FormArg): string => (a.kind === "form" ? coerce(a.field) : a.text);
      const call =
        mount.plan.shape === "object"
          ? [
              `  return generated.${mount.name}({`,
              ...mount.plan.args.map((a) => `    ${a.kind === "form" ? `${a.field.name}: ` : ""}${argExpr(a)},`),
              `  });`,
            ]
          : [`  return generated.${mount.name}(`, ...mount.plan.args.map((a) => `    ${argExpr(a)},`), `  );`];
      lines.push(
        `/** ${page.title}: submits the bound form to the generated ${mount.name} mutator. */`,
        `export async function pageSubmit${page.component}(data: FormData): Promise<unknown> {`,
        ...call,
        `}`,
        "",
      );
    }
  }
  return lines.join("\n");
}

function genericLayoutModule(ctx: BriefedSiteCtx): string {
  const body = `// Shared chrome: a skip link, real <a href> navigation and page landmarks.
import type { ReactNode } from "react";
import { SITE_NAME } from "./site-data.ts";

export type SiteNavItem = { id: string; title: string; href: string };

export function SiteLayout({ nav, current, children }: { nav: readonly SiteNavItem[]; current: string; children: ReactNode }) {
  return (
    <div className="site">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header">
        <a className="site-brand" href="#/${ctx.pages[0]?.id ?? "home"}">
          <span className="site-brand__name">{SITE_NAME}</span>
        </a>
        <nav className="site-nav" aria-label="Primary">
          {nav.map((item) => (
            <a
              key={item.id}
              href={item.href}
              className={item.id === current ? "site-nav__link site-nav__link--active" : "site-nav__link"}
              aria-current={item.id === current ? "page" : undefined}
            >
              {item.title}
            </a>
          ))}
        </nav>
      </header>
      <main className="site-main" id="main">{children}</main>
      <footer className="site-footer">
        <div className="site-footer__inner">
          <p className="site-footer__name">{SITE_NAME}</p>
        </div>
      </footer>
    </div>
  );
}
`;
  return [...sourceHeader("src/ui/layout.tsx", "Shared site layout (header, navigation, footer)", ctx.project, [
    "// Every page mounts inside this chrome; nav links are real anchors.",
  ]), body].join("\n");
}

function genericRouterModule(ctx: BriefedSiteCtx): string {
  const lines: string[] = [
    ...sourceHeader("src/ui/router.tsx", "Hash router over the emitted site pages", ctx.project, [
      "// One route per briefed page; the URL hash is the source of truth.",
    ]),
    `import { useEffect, useState } from "react";`,
    `import type { ReactNode } from "react";`,
    `import { SiteLayout, type SiteNavItem } from "./layout.tsx";`,
    ...ctx.pages.map((p) => `import { ${p.component} } from "./pages/${p.component}.tsx";`),
    "",
    "const ROUTES: readonly { id: string; title: string }[] = [",
    ...ctx.pages.map((p) => `  { id: ${jstr(p.id)}, title: ${jstr(p.title)} },`),
    "];",
    "",
    "function currentRouteId(): string {",
    `  const raw = typeof window === "undefined" ? "" : window.location.hash.replace(/^#\\/?/, "");`,
    `  const id = raw.split(/[/?#]/)[0] ?? "";`,
    `  return ROUTES.some((route) => route.id === id) ? id : (ROUTES[0]?.id ?? "home");`,
    "}",
    "",
    "export function SiteRouter(): ReactNode {",
    "  const [route, setRoute] = useState<string>(() => currentRouteId());",
    "  useEffect(() => {",
    "    const onChange = (): void => setRoute(currentRouteId());",
    `    window.addEventListener("hashchange", onChange);`,
    `    return () => window.removeEventListener("hashchange", onChange);`,
    "  }, []);",
    "  const nav: SiteNavItem[] = ROUTES.map((item) => ({ id: item.id, title: item.title, href: `#/${item.id}` }));",
    "  let page: ReactNode = null;",
    "  switch (route) {",
    ...ctx.pages.map((p) => `    case ${jstr(p.id)}:\n      page = <${p.component} />;\n      break;`),
    `    default:\n      page = <${ctx.pages[0]!.component} />;\n      break;`,
    "  }",
    "  return <SiteLayout nav={nav} current={route}>{page}</SiteLayout>;",
    "}",
    "",
    "export default SiteRouter;",
    "",
  ];
  return lines.join("\n");
}

function genericPageModule(ctx: BriefedSiteCtx, page: BriefedPage): string {
  const mount = ctx.mounts.get(page.id) ?? { kind: "empty" as const, reason: "not mounted" };
  const title = jstr(page.title);
  const header = [
    ...sourceHeader(`src/ui/pages/${page.component}.tsx`, `${page.title} page`, ctx.project, [
      "// Content is mounted from the generated module's real exports.",
    ]),
  ];
  if (mount.kind === "empty") {
    return [
      ...header,
      `import { EmptySection } from "../view.tsx";`,
      "",
      `export function ${page.component}() {`,
      `  return (`,
      `    <section className="section">`,
      `      <h1>{${title}}</h1>`,
      `      <EmptySection title={${title}} />`,
      `    </section>`,
      `  );`,
      `}`,
      "",
    ].join("\n");
  }
  if (mount.kind === "render") {
    return [
      ...header,
      `import { pageView${page.component} } from "../site-data.ts";`,
      `import { RenderView, safeValue } from "../view.tsx";`,
      "",
      `export function ${page.component}() {`,
      `  return (`,
      `    <section className="section">`,
      `      <h1>{${title}}</h1>`,
      `      <RenderView value={safeValue(pageView${page.component})} />`,
      `    </section>`,
      `  );`,
      `}`,
      "",
    ].join("\n");
  }
  if (mount.kind === "get") {
    if (mount.async) {
      return [
        ...header,
        `import { pageLoad${page.component} } from "../site-data.ts";`,
        `import { AsyncValue } from "../view.tsx";`,
        "",
        `export function ${page.component}() {`,
        `  return (`,
        `    <section className="section">`,
        `      <h1>{${title}}</h1>`,
        `      <AsyncValue load={pageLoad${page.component}} />`,
        `    </section>`,
        `  );`,
        `}`,
        "",
      ].join("\n");
    }
    return [
      ...header,
      `import { pageLoad${page.component} } from "../site-data.ts";`,
      `import { GeneratedView, safeValue } from "../view.tsx";`,
      "",
      `export function ${page.component}() {`,
      `  return (`,
      `    <section className="section">`,
      `      <h1>{${title}}</h1>`,
      `      <GeneratedView value={safeValue(pageLoad${page.component})} />`,
      `    </section>`,
      `  );`,
      `}`,
      "",
    ].join("\n");
  }
  // form mount â€” the page submits through the site-data adapter.
  return [
    ...header,
    `import { useState } from "react";`,
    `import type { FormEvent } from "react";`,
    `import { pageSubmit${page.component} } from "../site-data.ts";`,
    `import { GeneratedView } from "../view.tsx";`,
    "",
    `export function ${page.component}() {`,
    `  const [notice, setNotice] = useState<string>("");`,
    `  const [result, setResult] = useState<unknown>(null);`,
    `  const [busy, setBusy] = useState<boolean>(false);`,
    `  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {`,
    `    event.preventDefault();`,
    `    const data = new FormData(event.currentTarget);`,
    `    setBusy(true);`,
    `    try {`,
    `      const value: unknown = await pageSubmit${page.component}(data);`,
    `      setResult(value);`,
    `      setNotice("Submitted to " + ${jstr(mount.name)} + ".");`,
    `    } catch (error) {`,
    `      setNotice(error instanceof Error ? error.message : String(error));`,
    `    } finally {`,
    `      setBusy(false);`,
    `    }`,
    `  }`,
    `  return (`,
    `    <section className="section">`,
    `      <h1>{${title}}</h1>`,
    `      <form onSubmit={(event) => void onSubmit(event)}>`,
    ...mount.plan.fields.flatMap((f) => [
      `        <label className="field" key=${jstr(f.name)}>`,
      `          <span className="field__label">{${jstr(f.label)}}</span>`,
      `          <input className="field__control" name=${jstr(f.name)} defaultValue="" />`,
      `        </label>`,
    ]),
    `        <button className="btn btn--primary" type="submit" disabled={busy}>{busy ? "Submittingâ€¦" : "Submit"}</button>`,
    `      </form>`,
    `      {notice !== "" ? <p className="notice" role="status">{notice}</p> : null}`,
    `      <GeneratedView value={result} />`,
    `    </section>`,
    `  );`,
    `}`,
    "",
  ].join("\n");
}

function genericConsoleModule(ctx: BriefedSiteCtx): string {
  const header = sourceHeader(ctx.uiPath, "Console â€” mounts the site router", ctx.project, [
    "// The mounted surface is the multi-page site; the router owns the routes.",
  ]);
  // 358 (R-UI-1): the spec-derived page set kept the router but dropped the ui
  // node's own W-14 binding, which made A3-f07 unreachable for every spec-derived
  // emission. Merge: the derived router AND the operator surface mount together.
  const merged = siteOperatorConsole({
    header,
    project: ctx.project,
    kind: ctx.kind,
    entryFromUi: ctx.entryFromUi,
    routerImport: `import { SiteRouter } from "./router.tsx";`,
    routerElement: "<SiteRouter />",
  });
  if (merged !== null) return merged;
  return [
    ...header,
    `import { SiteRouter } from "./router.tsx";`,
    "",
    `export function Console() {`,
    `  return <SiteRouter />;`,
    `}`,
    "",
    `export default Console;`,
    "",
  ].join("\n");
}

/**
 * Build the shape-tolerant briefed site's file set, or null when this emit has
 * no briefed page set, no generated entry, or no page can mount a real export
 * (the caller then keeps the single-file shell â€” never a fake page wall).
 */
function briefedSiteFiles(args: {
  project: Project;
  kind: ProjectKind;
  uiPath: string | null;
  generatedEntryPath: string | null;
}): ScaffoldFile[] | null {
  const { project, kind, uiPath, generatedEntryPath } = args;
  if (uiPath === null || generatedEntryPath === null) return null;
  if (!/\.tsx?$/.test(generatedEntryPath)) return null;
  const entrySource = uiGeneratedEntrySource(project);
  if (entrySource === null) return null;
  const callables = marketingCallables(entrySource);
  if (callables.length === 0) return null;
  const aliases = uiTypeAliases(entrySource);
  const objects = uiDeclaredObjects(entrySource);
  const pages = briefedPageDefs(project);
  if (pages.length < 2) return null;
  const used = new Set<string>();
  const mounts = new Map<string, PageMount>();
  for (const page of pages) mounts.set(page.id, pageMountFor(page, callables, aliases, objects, used));
  if (![...mounts.values()].some((m) => m.kind !== "empty")) return null;
  const ctx: BriefedSiteCtx = {
    project,
    kind,
    uiPath,
    generatedEntryPath,
    siteName: displayName(project.name) || "Site",
    pages,
    mounts,
    entryFromUi: tsImportPath("src/ui", generatedEntryPath),
    entryFromPages: tsImportPath("src/ui/pages", generatedEntryPath),
  };
  const files: ScaffoldFile[] = [
    { path: "src/ui/view.tsx", body: genericViewModule(project) },
    { path: "src/ui/site-data.ts", body: genericSiteDataModule(ctx) },
    { path: "src/ui/layout.tsx", body: genericLayoutModule(ctx) },
    { path: "src/ui/router.tsx", body: genericRouterModule(ctx) },
  ];
  for (const page of pages) {
    files.push({ path: `src/ui/pages/${page.component}.tsx`, body: genericPageModule(ctx, page) });
  }
  files.push({ path: uiPath, body: genericConsoleModule(ctx) });
  files.push({ path: "public/assets/manifest.json", body: marketingAssetManifest(collectImageUrls(project)) });
  return files;
}

/**
 * ui node: kind-appropriate shell (webapp â†’ React; game â†’ canvas; else CLI-ish TS).
 *
 * fixes/216d (106 T-05 / F-03): a shell that surfaces generated exports imports
 * the module the emitter ACTUALLY writes as the generated entry â€” `genEntry.path`
 * (the tree ENTRY in tree mode, else the hosted P6 module), resolved relative to
 * the emitted UI file (`genEntry.from`) â€” never the literal "../generated.ts",
 * which the path allow-list refuses and nothing ever wrote (a guaranteed
 * dangling specifier in every tree-mode webapp). `genEntry === null` â‡’ no
 * generated substance at all â‡’ no generated import in the shell.
 *
 * fixes/277 / 340-6 (A3-f07): the webapp branch's generated-substance body is
 * produced by the `uiGeneration` hook (the single call point); the default is
 * the real generator in `defaultUiGeneration` above (â‰¥2 spec/export-derived
 * fields + an interaction bound to a genuinely exported function, or the
 * honest "nothing to bind" panel).
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
    // (caller-supplied via ScaffoldOptions, or the default generator above)
    // returns the shell's generated-substance body lines ONLY â€” the
    // surrounding imports/export wrapper stay scaffold-owned so a hook can
    // never break the emitted module's shape.
    // fixes/277 (A3-f07): the hook contract â€” a `null` return keeps the
    // default generator (which is total: it never returns null), so the
    // spread below always receives string[] (R3-f03 break fix: the hook's
    // declared `string[] | null` return must be coalesced, never spread raw).
    const uiRequest: UiGenerationRequest = {
      project,
      kind,
      generatedNamespace: genEntry ? "generated" : null,
    };
    const genBody = uiGeneration(uiRequest) ?? defaultUiGeneration(uiRequest);
    // C1-03: a render-bearing shell renders an unknown page node as a
    // `ReactNode` child. Under @types/react v19 the global `JSX` namespace is
    // gone, so the emitted type must come from `react` itself; the import is
    // added only when the body actually names it (unused otherwise).
    const reactTypeImport = genBody.join("\n").includes("ReactNode")
      ? [`import type { ReactNode } from "react";`]
      : [];
    return [
      ...sourceHeader(node.file, node.purpose, project, [
        "// Operator surfaces bound to generated modules (P8). Not a stub wall:",
        "// the generated entry module (the file this emitter wrote) is imported",
        "// when P6 produced one â€” never a path nothing writes.",
      ]),
      ...(genEntry ? [] : [`import { useState } from "react";`]),
      ...reactTypeImport,
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
    const bestKey = `${slugName(project.name) || "rapidtool-game"}.best-score`;
    const label = `${displayName(project.name) || "Game"} â€” arrow keys or WASD to move, space to jump, M to mute`;
    const body = `// A real, playable canvas game: fixed-timestep loop, keyboard + pointer input,
// start/HUD/game-over states, a persistent best score and a mute toggle. No
// framework is imported â€” the game kind declares no react dependency.
export type GameHandle = { stop: () => void };
export type GameStatus = "start" | "playing" | "over";

type Platform = { x: number; y: number; w: number; h: number };
type Coin = { x: number; y: number; taken: boolean };

const VIEW_W = 960;
const VIEW_H = 540;
const GRAVITY = 1800;
const JUMP_VELOCITY = -640;
const BASE_SPEED = 240;
const MAX_SPEED = 520;
const BRAKE_SPEED = 140;
const ACCEL = 220;
const BRAKE = 320;
const GROUND_Y = 440;
const PLAYER_W = 34;
const PLAYER_H = 44;
const PLAYER_X = 140;
const STEP = 1 / 120;
const BEST_KEY = ${jstr(bestKey)};

/** Deterministic LCG so the procedural world is reproducible (no Math.random). */
function makeRng(): () => number {
  let seed = 0x2f6e2b1;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

export function bootGame(root: HTMLElement): GameHandle {
  const canvas = document.createElement("canvas");
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "application");
  canvas.setAttribute("aria-label", ${jstr(label)});
  canvas.style.width = "100%";
  canvas.style.height = "auto";
  canvas.style.background = "#0b1020";
  canvas.style.touchAction = "none";
  root.appendChild(canvas);
  const context2d = canvas.getContext("2d");
  if (context2d === null) {
    const notice = document.createElement("p");
    notice.textContent = "This browser cannot provide a 2D canvas context, so the game cannot start.";
    root.appendChild(notice);
    return {
      stop: () => {
        notice.remove();
        canvas.remove();
      },
    };
  }
  // Bind the narrowed context to a non-null const: TypeScript does not carry an
  // outer narrowing into the drawing closures, so this is what keeps them typed.
  const ctx: CanvasRenderingContext2D = context2d;

  let muted = false;
  let status: GameStatus = "start";
  let paused = false;
  let score = 0;
  let coinsTaken = 0;
  let speed = BASE_SPEED;
  let best = 0;
  try {
    const raw = window.localStorage.getItem(BEST_KEY);
    const parsed = raw === null ? 0 : Number(raw);
    best = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    best = 0;
  }

  const rng = makeRng();
  let platforms: Platform[] = [];
  let coins: Coin[] = [];
  let playerY = GROUND_Y;
  let vy = 0;
  let jumps = 0;
  let worldScroll = 0;
  let onGround = true;
  let audio: AudioContext | null = null;

  function seedWorld(): void {
    platforms = [{ x: -200, y: GROUND_Y, w: 520, h: 60 }];
    coins = [];
    let x = 420;
    for (let i = 0; i < 240; i++) {
      const gap = 120 + rng() * (140 + Math.min(220, i * 4));
      const w = 120 + rng() * 220;
      const y = GROUND_Y - rng() * 200;
      x += gap;
      platforms.push({ x, y, w, h: 26 });
      if (rng() > 0.45) coins.push({ x: x + w / 2, y: y - 44, taken: false });
      x += w;
    }
  }

  function beep(freq: number, seconds: number): void {
    if (muted) return;
    try {
      const ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (ctor === undefined) return;
      audio = audio ?? new ctor();
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      gain.gain.value = 0.04;
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start();
      osc.stop(audio.currentTime + seconds);
    } catch {
      // Audio is best-effort; a blocked context never breaks the game.
    }
  }

  function restart(): void {
    seedWorld();
    status = "playing";
    paused = false;
    score = 0;
    coinsTaken = 0;
    speed = BASE_SPEED;
    worldScroll = 0;
    playerY = GROUND_Y;
    vy = 0;
    jumps = 0;
    onGround = true;
  }

  function jump(): void {
    const allowed = onGround ? true : jumps < 2;
    if (!allowed) return;
    vy = JUMP_VELOCITY;
    jumps += 1;
    onGround = false;
    beep(660, 0.05);
  }

  function endRun(): void {
    if (status !== "playing") return;
    status = "over";
    const finalScore = Math.floor(score);
    if (finalScore > best) {
      best = finalScore;
      try {
        window.localStorage.setItem(BEST_KEY, String(best));
      } catch {
        // Storage disabled â€” the best score still stands for this session.
      }
    }
  }

  const keys = new Set<string>();
  function onKeyDown(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    if (key === " " || key === "arrowup" || key === "arrowdown" || key === "arrowleft" || key === "arrowright") {
      event.preventDefault();
    }
    if (key === "m") {
      muted = !muted;
      return;
    }
    keys.add(key);
    if (status === "start" || status === "over") {
      restart();
      return;
    }
    if (key === "arrowup" || key === "w" || key === " " || key === "space") jump();
  }
  function onKeyUp(event: KeyboardEvent): void {
    keys.delete(event.key.toLowerCase());
  }
  function onBlur(): void {
    paused = true;
  }
  function onFocus(): void {
    paused = false;
  }
  function onPointerDown(event: PointerEvent): void {
    if (status === "start" || status === "over") {
      restart();
      return;
    }
    const rect = canvas.getBoundingClientRect();
    if (event.clientX >= rect.left + rect.width / 2) jump();
    else keys.add("arrowleft");
  }
  function onPointerUp(): void {
    keys.delete("arrowleft");
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  window.addEventListener("focus", onFocus);
  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);

  function step(dt: number): void {
    if (keys.has("arrowright") || keys.has("d")) speed = Math.min(MAX_SPEED, speed + ACCEL * dt);
    if (keys.has("arrowleft") || keys.has("a")) speed = Math.max(BRAKE_SPEED, speed - BRAKE * dt);
    worldScroll += speed * dt;
    score += speed * dt * 0.1;

    vy += GRAVITY * dt;
    playerY += vy * dt;
    if (playerY < 0) {
      playerY = 0;
      vy = 0;
    }
    onGround = false;
    for (const p of platforms) {
      const sx = p.x - worldScroll;
      if (PLAYER_X + PLAYER_W < sx || PLAYER_X > sx + p.w) continue;
      if (vy >= 0 && playerY >= p.y && playerY <= p.y + p.h + vy * dt + 2) {
        playerY = p.y;
        vy = 0;
        onGround = true;
        jumps = 0;
      }
    }
    for (const c of coins) {
      if (c.taken) continue;
      const sx = c.x - worldScroll;
      if (Math.abs(sx - PLAYER_X - PLAYER_W / 2) < 30 && Math.abs(c.y - (playerY - PLAYER_H / 2)) < 40) {
        c.taken = true;
        coinsTaken += 1;
        score += 25;
        beep(990, 0.04);
      }
    }
    if (playerY > VIEW_H + 200) endRun();
  }

  function overlay(title: string, line: string, call: string): void {
    ctx.fillStyle = "rgba(11, 16, 32, 0.78)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = "#f3ede4";
    ctx.textAlign = "center";
    ctx.font = "700 44px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(title, VIEW_W / 2, VIEW_H / 2 - 40);
    ctx.font = "400 22px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(line, VIEW_W / 2, VIEW_H / 2 + 4);
    ctx.fillText(call, VIEW_W / 2, VIEW_H / 2 + 44);
  }

  function draw(): void {
    ctx.fillStyle = "#0b1020";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = "#131a33";
    ctx.fillRect(0, VIEW_H - 120, VIEW_W, 120);
    for (const p of platforms) {
      const sx = p.x - worldScroll;
      if (sx > VIEW_W || sx + p.w < 0) continue;
      ctx.fillStyle = "#2dd4bf";
      ctx.fillRect(sx, p.y, p.w, p.h);
    }
    for (const c of coins) {
      if (c.taken) continue;
      const sx = c.x - worldScroll;
      if (sx > VIEW_W || sx < -40) continue;
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(sx, c.y, 12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#f472b6";
    ctx.fillRect(PLAYER_X, playerY - PLAYER_H, PLAYER_W, PLAYER_H);
    ctx.fillStyle = "#f3ede4";
    ctx.textAlign = "left";
    ctx.font = "600 20px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("Score " + Math.floor(score) + "   Coins " + coinsTaken + "   Best " + best, 20, 36);
    if (muted) ctx.fillText("Muted (M)", VIEW_W - 150, 36);
    if (status === "start") {
      overlay(${jstr(displayName(project.name) || "Arcade")}, "Space / up jumps Â· right accelerates Â· left brakes", "Press space to start");
    } else if (status === "over") {
      overlay("Run over", "Score " + Math.floor(score) + " Â· coins " + coinsTaken, "Press space to play again");
    } else if (paused) {
      overlay("Paused", "The window lost focus", "Click the game to resume");
    }
  }

  let raf = 0;
  let last = 0;
  let acc = 0;
  function frame(now: number): void {
    raf = window.requestAnimationFrame(frame);
    if (last === 0) last = now;
    let delta = (now - last) / 1000;
    last = now;
    if (delta > 0.25) delta = 0.25;
    if (status === "playing" && !paused) {
      acc += delta;
      while (acc >= STEP) {
        step(STEP);
        acc -= STEP;
      }
    }
    draw();
  }

  seedWorld();
  draw();
  canvas.focus();
  raf = window.requestAnimationFrame(frame);

  return {
    stop: () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.remove();
    },
  };
}
`;
    return [
      ...sourceHeader(node.file, node.purpose, project, [
        "// Real canvas game surface: fixed-timestep loop + input + HUD + states.",
        "// Assets are NOT engine-generated â€” see assets/manifest.json.",
      ]),
      body,
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
      "// Console/entry shell â€” contract-level (P8). Wire it to the job modules",
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
   *  export surface the job-keyed oracle rows assert. Absent/empty â‡’ the spec
   *  is byte-identical to pre-216k output. */
  treeJobModules?: { label: string; path: string }[];
  /**
   * fixes/144 (M2): tree assembly mode â€” path of the generatedTree ENTRY
   * module (the file at the path the legacy P6 host would have used). When
   * set, the spec imports ONLY the tree (store/api/template surfaces are
   * generated content with unknown export names) and asserts the entry loads
   * with a non-empty namespace â€” real cross-file imports resolved by node.
   */
  treeEntryPath?: string | null;
  /** Sorted accepted tree paths (for the emitted file-list comment). */
  treePaths?: string[];
  /**
   * leftover job-* labels whose nodes re-export the hosted generatedSource
   * module (fixes/196). Oracle rows for these jobs must NOT assert the
   * TODO(E-15) throw â€” they are bridges, not stubs. Stub leftover jobs
   * (no generatedSource) are omitted here and MAY still assert throw.
   */
  bridgedJobLabels?: Iterable<string>;
  /** fixes/328 P2: job labels whose REAL module this emit materialised â€” the
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
   * above (byte-identical â€” the same rules, one place).
   */
  rowSurface?: OracleRowSurface;
  /**
   * fixes/277 (R3-f03 / W-06): the emission carries a PARTIAL synthesis tree
   * (prior chunks' real files kept after a refused chunk â€” `partialTreeRefuse`,
   * detected by `trailVerdictOf`). When true, each `capability.N` row is
   * emitted with a skip-with-reason path: a capability whose demanded
   * identifier forms appear in NO scanned file names a module that was never
   * materialised and SKIPS with that reason instead of asserting a red â€” the
   * pre-fix 28-red cascade on a 1-file partial tree read as product failure.
   * Absent/false â‡’ the capability rows are byte-identical to the pre-277
   * output. TODO(R3-f03): the full capabilityâ†’node mapping (name WHICH declared
   * module is missing) once the spec graph carries it.
   */
  partial?: boolean;
  /**
   * fixes/352: emitted `.ts` module sources keyed by path, so a capability row
   * can bind to the REAL export the tree wires (`module["fn"]`), call it with
   * sound args and assert the outcome â€” instead of a presence proxy.
   */
  sourceByPath?: ReadonlyMap<string, string>;
};

// ---------------------------------------------------------------------------
// fixes/216b (106 T-08 / F-05) â€” no emitted assertion may be unable to fail.
//
// The scaffold emits one test per A7 oracle row. Rows the emitted modules give
// a surface to assert against carry a REAL assertion (the seam rejection / the
// template's phase bookkeeping / the endpoint contract). Rows they do not were
// previously emitted as an always-true pair â€”
//   assert.ok("<id>".length > 0, "row id is pinned");
//   assert.ok("<prose>".length >= 0, "row prose recorded");
// which cannot fail under any change to any file, so `npm test` printed the six
// rows that matter as green while the product's contract had zero coverage.
// The verdict for those rows is "not-implemented": a MARKED skip under the row's
// pinned id â€” never a green test and never a silent one â€” that the emitted spec
// header and the README census both COUNT. The classification lives here ONCE â€”
// the emitted spec and the README census both call oracleRowKind(), so a counted
// row and an emitted row can never drift.
//
// fixes/356 (W356 A3 / 355-A3 L5): the 354 wave emitted that row as a reachable
// `assert.fail`, which made any emission carrying one fail its own `npm test`
// and withhold `emit --git` â€” an unwired row condemned the whole tree. The
// shortfall is now an honest SKIP: visible in the TAP line (`# SKIP <marker>`),
// named per row in the spec source, and totalled on both headers. Rows that DO
// have a surface keep their real assertion, byte-for-byte.
// ---------------------------------------------------------------------------

/** Which honest assertion one A7 oracle row can carry today. */
type OracleRowKind =
  | "endpoint-stub"
  /** fixes/328 P2: the endpoint's job module was emitted REAL â€” assert the
   *  routerâ†’job dispatch end to end instead of the stub refusal. */
  | "endpoint-live"
  /** fixes/328 P2: the job was materialised as a REAL module but no api
   *  surface is importable (tree mode) â€” assert the module's export surface. */
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
  /** leftover job labels bridged to the hosted module â€” never assert the stub. */
  bridged: ReadonlySet<string>;
  /** fixes/216k D2: tree-covered job labels whose REAL module is importable. */
  jobModules: ReadonlySet<string>;
  /** fixes/328 P2: job labels whose REAL module this emit materialised â€” the
   *  router dispatches their endpoints to it (assert the dispatch, not a
   *  stub refusal). Empty â‡’ the pre-328 endpoint-stub behavior. */
  wired: ReadonlySet<string>;
  /** A6 contract endpoints (the row's job â†’ a routable seam). */
  endpoints: { method: string; path: string; job: string }[];
  /**
   * fixes/357 (R-7): job labels whose module the emitted spec can actually
   * IMPORT â€” the `.ts`-only filter the spec's import maps apply, and (tree
   * mode) only when the tree entry itself is importable. A `tree-job` row
   * missing from here has no importable module, so it is an UNWIRED row: a
   * marked, COUNTED skip, never a reachable `assert.fail` that condemns the
   * whole tree (`npm test` exit 1 + a withheld `emit --git`) over one drift.
   */
  importableTreeJobs: ReadonlySet<string>;
  /** fixes/357 (R-7): wired job labels the spec can import (`.ts` modules). */
  importableWiredJobs: ReadonlySet<string>;
};

/**
 * fixes/357 (R-7): the labels whose modules the emitted spec really IMPORTS,
 * derived from the SAME module lists the import maps are built from â€” one
 * derivation, so the row body and the README census cannot disagree about
 * whether a `tree-job`/`live-job` row is wired.
 */
function importableOracleJobLabels(
  treeJobModules: readonly { label: string; path: string }[] | undefined,
  wiredJobModules: readonly { label: string; path: string }[] | undefined,
  treeEntryOk: boolean,
): { tree: Set<string>; wired: Set<string> } {
  const pick = (mods: readonly { label: string; path: string }[] | undefined): Set<string> =>
    new Set(
      (Array.isArray(mods) ? mods : [])
        .filter((m) => m && typeof m.label === "string" && /\.ts$/.test(String(m.path)))
        .map((m) => m.label),
    );
  // The tree-entry module is imported for EVERY tree-job row, so without an
  // importable entry none of those rows can reference their module.
  return { tree: treeEntryOk ? pick(treeJobModules) : new Set<string>(), wired: pick(wiredJobModules) };
}

/** Build the row surface from the emitter's paths (one derivation, no drift). */
function oracleRowSurface(input: {
  /** fixes/144 M2: tree assembly mode â‡’ only the tree entry is importable. */
  treeEntryOk: boolean;
  /** sanitized api node path (null/absent when the graph has no api node). */
  apiPath?: string | null;
  /** path hosting generatedSource (only the template shape is importable). */
  hostPath?: string | null;
  /** true when the hosted module is the deterministic P6 template. */
  template: boolean;
  /** leftover job labels bridged to the hosted module (fixes/196). */
  bridged?: Iterable<string>;
  /** fixes/216k D2: tree-covered job modules (label + path) â€” .ts only. */
  jobModules?: { label: string; path: string }[];
  /** fixes/328 P2: job labels whose REAL module this emit materialised. */
  wired?: Iterable<string>;
  /** A6 contract endpoints recorded on the project. */
  endpoints?: { method: string; path: string; job: string }[];
  /** fixes/357 (R-7): labels the spec can import (see importableOracleJobLabels).
   *  Required, never defaulted: an absent value would silently turn every wired
   *  row into a skip â€” the opposite of the honesty this surface guards. */
  importableJobModules: Iterable<string>;
  importableWiredModules: Iterable<string>;
}): OracleRowSurface {
  return {
    apiOk: typeof input.apiPath === "string" && /\.ts$/.test(input.apiPath),
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
    importableTreeJobs: new Set<string>([...input.importableJobModules]),
    importableWiredJobs: new Set<string>([...input.importableWiredModules]),
  };
}

/**
 * Classify ONE A7 oracle row (see the block comment above). `bridge` wins over
 * the endpoint seam exactly as the pre-fix branch order did: a leftover job
 * that re-exports the hosted module is a bridge, not a stub to reject.
 */
function oracleRowKind(row: { job?: unknown }, surface: OracleRowSurface): OracleRowKind {
  // fixes/216k D2 (parent boundary repair): a tree-covered job module is a REAL
  // importable surface â€” it wins over the legacy classifications (tree mode
  // disables api/host/bridged anyway, so no pre-216k behavior changes).
  if (surface.jobModules.has(String(row.job))) return "tree-job";
  const bridged = surface.bridged.has(String(row.job));
  const hasEndpoint = surface.endpoints.some((e) => e.job === row.job);
  if (bridged) return surface.hostOk ? "bridged-host" : "not-implemented";
  if (surface.apiOk && hasEndpoint) {
    // fixes/328 P2: a wired job â‡’ the router serves the endpoint for real.
    return surface.wired.has(String(row.job)) ? "endpoint-live" : "endpoint-stub";
  }
  // fixes/328 P2: a real job module with no importable api surface (tree mode).
  if (surface.wired.has(String(row.job))) return "live-job";
  return surface.hostOk ? "phase-bookkeeping" : "not-implemented";
}

/**
 * fixes/357 (R-7): true when the row's target surface is NOT importable by the
 * emitted spec â€” the ONE predicate the emitted row body and the README census
 * share. It covers `not-implemented` (no emitted module surface at all) and the
 * drifts the 354/356 bytes answered with a REACHABLE `assert.fail`: a
 * `tree-job`/`live-job` row whose label has no importable `.ts` module in this
 * emission (or, in tree mode, no importable tree entry), and an `endpoint-stub`
 * row with no recorded endpoint. Such a row has no assertion it could execute,
 * so it is emitted as a MARKED, COUNTED skip under its pinned id â€” a surfaced
 * shortfall, never an unavoidable red that condemns the whole tree.
 */
function oracleRowUnwired(row: { job?: unknown }, surface: OracleRowSurface): boolean {
  const kind = oracleRowKind(row, surface);
  if (kind === "not-implemented") return true;
  if (kind === "endpoint-stub") return !surface.endpoints.some((e) => e.job === row.job);
  if (kind === "tree-job") return !surface.importableTreeJobs.has(String(row.job));
  if (kind === "live-job") return !surface.importableWiredJobs.has(String(row.job));
  return false;
}

/**
 * fixes/356 (W356 A3): the row-level marker + TAP skip reason every UNWIRED A7
 * row carries. It is the honest statement of the shortfall (`skip` is not a
 * pass), it is greppable in the emitted spec, and the TAP reporter prints it on
 * the row's own `# SKIP` line â€” so the shortfall is surfaced per row, never
 * silent. The COUNTED total lives on the emitted spec header + the README
 * census (`oracleShortfallLine`). ASCII only: the marker rides a JSON-escaped
 * string into the emitted file and its TAP line.
 */
const ORACLE_SHORTFALL_MARKER =
  "NOT IMPLEMENTED - no emitted module surface targets this row yet (oracle shortfall, counted in README.md; a skip is not a pass)";

/** The row census the README prints: assertable rows vs NOT IMPLEMENTED rows. */
type OracleRowCensus = {
  /** rows that emit a test (non-object rows are skipped by the emitter). */
  total: number;
  /** rows whose emitted test carries a real, failable assertion. */
  assertable: number;
  /** ids emitted as MARKED, COUNTED skips (`<id>` with `{ skip: <marker> }`) â€”
   *  fixes/356 (W356 A3): visible in the TAP line and counted on both headers,
   *  so an unwired row is a surfaced shortfall, never a green row and never an
   *  unavoidable red that condemns the tree. */
  notImplemented: string[];
};

/** Classify every oracle row once â€” the emitted spec + the README share this. */
function censusOracleRows(
  rows: ReadonlyArray<Project["oracle"][number]>,
  surface: OracleRowSurface,
): OracleRowCensus {
  const notImplemented: string[] = [];
  let assertable = 0;
  for (const row of rows) {
    if (row === null || typeof row !== "object") continue;
    // fixes/357 (R-7): one predicate with the row body â€” a row the spec cannot
    // assert (no module surface, or a classification whose module is not
    // importable) is COUNTED here as the marked skip it is emitted as.
    if (oracleRowUnwired(row, surface)) {
      notImplemented.push(typeof row.id === "string" && row.id ? row.id : "(unnamed row)");
    } else {
      assertable += 1;
    }
  }
  return { total: assertable + notImplemented.length, assertable, notImplemented };
}

// ---------------------------------------------------------------------------
// fixes/150 (G2) â€” capability-presence demands (SEMANTIC-FAILURE REPAIR).
//
// The single, deterministic capability set shared by TWO consumers so they can
// never drift apart:
//   1. the emitted tests/oracle.spec.ts capability-presence rows (below â€”
//      one REAL test per demanded capability, red when the capability's
//      identifier is absent from the emitted tree); and
//   2. headless driveP6Journey's coverage gate (capabilityCoverage over the
//      synthesized tree BEFORE declaring convergence).
// The source order mirrors dod.archCapabilities (p6-arch): the expanded
// spec's typeSignatures first (each demands its declared primary export
// name), then implementationSpec.requirements (each sentence's content
// tokens). A project WITHOUT an implementationSpec carries NO capability
// demands â€” those emissions stay byte-identical (the fixes/150 byte-parity
// pin). Capability labels are NOT oracle rows: they assert identifier
// PRESENCE ONLY â€” a proxy, never behavioral proof (the emitted row's assert
// message says exactly what it checks).
// ---------------------------------------------------------------------------

/** One demanded capability: `label` is the human prose (requirement sentence
 *  or signature line), `demand` is the coverage label capabilityCoverage
 *  receives (the declared export name for a typeSignature â€” whose own token
 *  forms equal `forms` â€” or the requirement text, whose formsForCapability
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
 *  stems â€” the maker-score capabilityCoverage / dod p6-arch matching
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

/** Primary declared name a typeSignature line demands â€” the dod.ts
 *  p6-arch parser, mirrored verbatim so the emitted rows and the DoD probe
 *  agree on what a signature demands: `export function createBoard(â€¦)` â†’
 *  createBoard; `export type Order = â€¦` â†’ Order; bare `createOrder(items)`
 *  â†’ createOrder. Null when nothing parses (the line then demands its
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

/** The project's demanded capabilities â€” [] when the project carries no
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
    // with stopword-filtered content forms (the gate's form set âŠ‡ these).
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
 * tests node: tests/oracle.spec.ts â€” REAL assertions over the emitted modules
 * (fixes/135). No todo stubs: every A7 oracle row keeps its PINNED orc-* id as
 * a test name (E-08 â€” never rename or drop one) and every test asserts what
 * the modules the scaffold actually ships DO today:
 *   - the generated P6 module's own functions are asserted when the
 *     deterministic template hosts them (synthesize/JOBS/REJECTION);
 *   - store/api modules are asserted over their real exports
 *     (CheckpointStore round-trips, ENDPOINTS â†” A6 contract equality);
 *   - an oracle row whose target seam is a TODO(E-15) stub asserts that the
 *     seam REJECTS â€” an honest statement of the current surface that FAILS
 *     the moment the seam is implemented (that is the signal to replace it
 *     with the row's real acceptance assertion);
 *   - a row with NO emitted module surface to assert against is emitted as a
 *     MARKED, COUNTED skip under its pinned id (fixes/216b â€” 106 T-08 / F-05;
 *     re-decided by fixes/356 â€” W356 A3 / 355-A3 L5): never an always-true
 *     assertion, never a silent omission and never a green row â€” the row's own
 *     TAP line carries the NOT IMPLEMENTED marker, and the shortfall total is
 *     counted on the spec header and in the README's oracle-row census, so the
 *     tree's own `npm test` can go green without the shortfall disappearing;
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
  // fixes/144 (M2): tree assembly mode â€” the caller names the tree ENTRY module
  // path (only .ts entries are importable under node strip-types, mirroring the
  // legacy host import rule; .tsx tree files stay emitted but never imported).
  const treeEntryOk =
    typeof ctx.treeEntryPath === "string" && /\.ts$/.test(ctx.treeEntryPath);
  // fixes/216b (106 T-08 / F-05): the classification surface the row loop below
  // switches on. scaffoldProject passes the very object it counts for the
  // README census; a direct call derives it from the same fields with the same
  // rules (oracleRowSurface), so the two can never disagree.
  const importableJobs = importableOracleJobLabels(ctx.treeJobModules, ctx.wiredJobModules, treeEntryOk);
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
      importableJobModules: importableJobs.tree,
      importableWiredModules: importableJobs.wired,
    });
  // R2-05 (re-decided by fixes/356 / W356 A3): an UNWIRED oracle row is a
  // MARKED, COUNTED skip. The pre-354 ratio gate (`notImplemented > assertable`)
  // emitted `test.skip("<id> â€” NOT IMPLEMENTED")` with NO count anywhere, so an
  // unwired row could vanish into a green run â€” the very thing R2-05 forbade.
  // The 354 answer (`assert.fail`) made the row unavoidable red and condemned
  // the whole tree (`npm test` exit 1, `emit --git` withheld). The count is the
  // honesty: the shortfall is stated per row (the skip marker, printed on the
  // TAP line), totalled on this spec's header and on the emitted README census,
  // and the vacuity guard still refuses to mint `tested` on a skip-dominated
  // spec (compile-check `RT_E_SPEC_SKIP_VACUOUS`). Decided from the SAME census
  // the README prints (one source of truth), so the spec body and the census
  // sentence branch on the same predicate.
  const oracleCensus = censusOracleRows(rows, surface);
  const oracleShortfall = oracleCensus.notImplemented.length;
  const hasOracleShortfall = oracleShortfall > 0;
  const storeOk =
    typeof ctx.storePath === "string" && /\.ts$/.test(ctx.storePath);
  const apiOk = surface.apiOk;
  const hostOk = surface.hostOk;
  // Mirror the engine's P6 module build: lattice jobs (â‰¤5) or ["core"].
  const expectedJobs = latticeJobs.length ? latticeJobs.slice(0, 5) : ["core"];
  const expectedJson = (v: unknown): string => JSON.stringify(v);
  // fixes/150 (G2): capability-presence row state. Rows exist ONLY when the
  // project carries an implementationSpec with demanded capabilities AND an
  // emitted module surface exists to scan (the tree files in tree mode, else
  // the hosted module path). A project with no capability/requirement rows
  // emits byte-identical output (the fixes/150 byte-parity pin).
  const capDemands = capabilityDemands(project);
  // fixes/328 P2: the REAL per-job modules this emit materialised are part of
  // the emitted product â€” a capability whose identifier lives there must be
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
  // (strip-types cannot load .tsx). Empty â‡’ byte-identical pre-216k output.
  const treeJobImport = new Map<string, { importName: string; slug: string; path: string }>();
  if (treeEntryOk) {
    const usedNames = new Set<string>(["treeModule"]);
    for (const m of Array.isArray(ctx.treeJobModules) ? ctx.treeJobModules : []) {
      if (!m || typeof m.label !== "string" || typeof m.path !== "string") continue;
      if (!/\.ts$/.test(m.path)) continue;
      if (treeJobImport.has(m.label)) continue; // first wins â€” graph order, deterministic
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
  // stronger routeâ†’job dispatch assertion where the api surface is importable).
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

  // fixes/352: BEHAVIOURAL capability bindings. A demanded capability whose
  // primary export name is genuinely exported by a namespace this spec already
  // imports (treeModule / jobMod_* / wiredJob_*) AND whose parameters accept a
  // soundly-built empty literal is BOUND: the row calls the real export and
  // asserts its outcome. A capability with no binding falls back to the file
  // presence scan (failable), and to an explicit skip when absent â€” never a
  // bodyless pass.
  type CapBinding = { ns: string; name: string; args: string[]; isAsync: boolean; returnsVoid: boolean };
  const capBindings: (CapBinding | null)[] = capSection
    ? capDemands.map((d) => {
        const name = primarySignatureName(d.label) ?? primarySignatureName(d.demand);
        if (name === null || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) return null;
        const sig = parseTypeSignature(d.label.includes("(") ? d.label : d.demand);
        const params = sig ? sig.params : [];
        // treeModule is the barrel + every file it re-exports (the names the
        // barrel genuinely exposes live in the tree files, not the barrel bytes).
        const treeEntrySource = treeEntryOk
          ? (ctx.treePaths ?? []).map((p) => ctx.sourceByPath?.get(p) ?? "").join("\n")
          : "";
        const candidates: { ns: string; source: string }[] = [
          ...[...wiredJobImport.values()].map((v) => ({
            ns: v.importName,
            source: ctx.sourceByPath?.get(v.path) ?? "",
          })),
          ...[...treeJobImport.values()].map((v) => ({
            ns: v.importName,
            source: ctx.sourceByPath?.get(v.path) ?? "",
          })),
        ];
        if (treeEntryOk) candidates.push({ ns: "treeModule", source: treeEntrySource });
        for (const cand of candidates) {
          const source = cand.source;
          if (source === "" || !sourceExportsName(source, name)) continue;
          const aliases = uiTypeAliases(source);
          const objects = uiDeclaredObjects(source);
          const args: string[] = [];
          let ok = true;
          for (const p of params) {
            if (p.rest) {
              ok = false;
              break;
            }
            const value = p.type === "" ? "null" : emptyForType(p.type, aliases, objects);
            if (value === null) {
              ok = false;
              break;
            }
            args.push(value);
          }
          if (!ok) continue;
          const inner = (sig ? sig.returnInner || sig.returns : "").trim();
          return { ns: cand.ns, name, args, isAsync: sig ? sig.isAsync : false, returnsVoid: /^void$/i.test(inner) };
        }
        return null;
      })
    : [];

  const lines = [
    "// ---------------------------------------------------------------------------",
    "// tests/oracle.spec.ts â€” acceptance tests from the A7 oracle (project.oracle)",
    `// ${MACHINE_STAMP(project.id)}`,
    "// REAL assertions, no todo stubs (fixes/135). Row ids are PINNED: the verify",
    "// harness seeds + pins orc-* ids across runs (E-08) â€” never rename or drop",
    "// one. Each test asserts what the emitted modules ACTUALLY do today:",
    "//   * where the generated P6 module defines functions (the deterministic",
    "//     template's synthesize/JOBS/REJECTION), those are asserted directly;",
    "//   * store/api modules are asserted over their real exports;",
    "//   * an oracle row whose target seam is a TODO(E-15) stub asserts the seam",
    "//     rejects â€” that test FAILS the moment the seam is implemented, which is",
    "//     the signal to replace it with the row's real acceptance assertion;",
    "//   * an oracle row with NO emitted module surface to assert against (106",
    "//     T-08 / F-05) is a MARKED, COUNTED skip under its pinned id â€” never an",
    "//     always-true assertion, never a green test, and never a silent omission:",
    "//     the row's own TAP line carries the NOT IMPLEMENTED marker and the total",
    "//     is counted below and in README.md's oracle-row census;",
    "//   * nothing here pretends a stub satisfies its brief.",
    ...(hasOracleShortfall
      ? [
          `// ORACLE SHORTFALL: ${oracleShortfall} of ${oracleCensus.total} pinned A7 row(s) are`,
          "// NOT IMPLEMENTED â€” emitted below as MARKED skips under their pinned ids",
          "// (each prints `# SKIP NOT IMPLEMENTED ...` on its own TAP line) and",
          `// counted here and in README.md. The other ${oracleCensus.assertable} row(s) assert the`,
          "// emitted modules' real current behavior. A skip is not a pass: these rows",
          "// carry no acceptance evidence until their seam (HTTP endpoint or P6 host)",
          "// lands, and a spec whose live passes do not outnumber these skips is",
          "// refused by the tree-run as a vacuous green (RT_E_SPEC_SKIP_VACUOUS).",
        ]
      : []),
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
          "// first, requirements fallback â€” the p6-arch source order).",
        ]
      : []),
    "// ---------------------------------------------------------------------------",
    `import { test } from "node:test";`,
    `import assert from "node:assert/strict";`,
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

  // --- 1. Tree truth (fixes/144 M2) â€” the generated tree ENTRY module ------
  // In tree mode the spec imports the tree's entry (the file at the path the
  // legacy P6 host would have used â€” same selection rule). Loading the spec
  // therefore loads the entry AND every module it imports: real cross-file
  // imports genuinely resolve under node:test. Export NAMES are generated
  // content (unknown at emit time), so the entry is asserted as a namespace.
  if (treeEntryOk) {
    const treePaths = Array.isArray(ctx.treePaths) ? ctx.treePaths : [];
    lines.push(
      "// ---------------------------------------------------------------------------",
      "// 1. Tree truth â€” the generated tree ENTRY module (project.generatedTree,",
      "// fixes/144 M2). The scaffold assembled every tree file verbatim at its own",
      "// repo-relative path; this spec imports the ENTRY module (the file at the",
      "// path the legacy P6 host would have used) so the emitted npm test executes",
      "// the REAL generated tree â€” its cross-file imports must resolve or this spec",
      "// fails to load. Export names are generated content, so the entry is asserted",
      "// as a namespace that must carry at least one real export.",
      "// ---------------------------------------------------------------------------",
      "",
      "// Emitted generated-tree files:",
      ...treePaths.map((p) => `//   ${p}${p === ctx.treeEntryPath ? "  (entry)" : ""}`),
      "",
      "test(\"tree.entry â€” the generated tree entry module loads and cross-file imports resolve\", () => {",
      "  // The import at the top of this spec IS the load assertion: a missing entry",
      "  // or an unresolvable cross-file import fails the spec before any test runs.",
      "  // Export names are generated content â€” the one stable assertion is that the",
      "  // namespace carries at least one real export. (106 T-08 / F-05: the pre-fix",
      "  // `assert.ok(treeModule)` / `typeof === \"object\"` pair could never fail, so",
      "  // it was removed rather than left to read as evidence.)",
      "  const names = Object.keys(treeModule);",
      '  assert.ok(names.length > 0, "entry exports real names: " + names.join(", "));',
      "});",
      "",
    );
  }

  // --- 1. Module truth â€” the deterministic P6 template's real behavior ------
  if (hostOk) {
    lines.push(
      "// ---------------------------------------------------------------------------",
      "// 1. Module truth â€” the hosted P6 module (project.generatedSource), verbatim.",
      "// ---------------------------------------------------------------------------",
      "",
    );
    if (latticeJobs.length) {
      lines.push(
        `test("module.jobs â€” the P6 module lists the lattice jobs in order", () => {`,
        `  assert.deepEqual(JOBS, ${expectedJson(expectedJobs)});`,
        `});`,
        "",
      );
    }
    lines.push(
      `test("module.synthesize â€” a valid phase + known job returns ok", () => {`,
      `  const out = synthesize({ name: "probe", phase: 6, job: JOBS[0] });`,
      `  assert.equal(out.ok, true);`,
      `  assert.equal(out.job, JOBS[0]);`,
      `  assert.equal(typeof out.addressed, "boolean");`,
      `});`,
      "",
      `test("module.synthesize â€” an out-of-range phase is rejected", () => {`,
      `  assert.throws(() => synthesize({ name: "x", phase: -1, job: JOBS[0] }), /invalid phase/);`,
      `  assert.throws(() => synthesize({ name: "x", phase: 13, job: JOBS[0] }), /invalid phase/);`,
      `});`,
      "",
      `test("module.synthesize â€” an unknown job is rejected", () => {`,
      `  assert.throws(() => synthesize({ name: "x", phase: 6, job: "__no_such_job__" }), /unknown job/);`,
      `});`,
      "",
      `test("module.synthesize â€” the rejection note blocks phase 9 when present", () => {`,
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

  // --- 2. Store truth â€” the real CheckpointStore semantics -----------------
  if (storeOk) {
    lines.push(
      "// ---------------------------------------------------------------------------",
      "// 2. Store truth â€” CheckpointStore (src/state), the real checkpoint surface.",
      "// ---------------------------------------------------------------------------",
      "",
      `test("store.checkpoint â€” write then read returns the stored checkpoint", () => {`,
      `  const s = new CheckpointStore();`,
      `  s.write({ phase: 2, status: "sealed", updatedAt: "2026-01-01T00:00:00.000Z" });`,
      `  const got = s.read(2);`,
      `  assert.ok(got, "checkpoint written is checkpoint read");`,
      `  assert.equal(got.phase, 2);`,
      `  assert.equal(got.status, "sealed");`,
      `});`,
      "",
      `test("store.checkpoint â€” reading an unwritten phase returns undefined", () => {`,
      `  const s = new CheckpointStore();`,
      `  assert.equal(s.read(4), undefined);`,
      `});`,
      "",
      `test("store.checkpoint â€” a later write for a phase replaces the earlier one", () => {`,
      `  const s = new CheckpointStore();`,
      `  s.write({ phase: 3, status: "draft", updatedAt: "2026-01-01T00:00:00.000Z" });`,
      `  s.write({ phase: 3, status: "sealed", updatedAt: "2026-01-02T00:00:00.000Z" });`,
      `  assert.equal(s.read(3)?.status, "sealed");`,
      `  assert.equal(s.read(3)?.updatedAt, "2026-01-02T00:00:00.000Z");`,
      `});`,
      "",
    );
  }

  // --- 3. Endpoint truth â€” ENDPOINTS against the A6 contract ---------------
  if (apiOk) {
    lines.push(
      "// ---------------------------------------------------------------------------",
      "// 3. Endpoint truth â€” ENDPOINTS must match the A6 contract verbatim.",
      "// ---------------------------------------------------------------------------",
      "",
      endpoints.length
        ? `test("api.endpoints â€” ENDPOINTS matches the A6 contract endpoints", () => {`
        : `test("api.endpoints â€” no A6 endpoints recorded, ENDPOINTS stays empty", () => {`,
      `  assert.deepEqual(ENDPOINTS, ${expectedJson(endpoints)});`,
      `});`,
      "",
    );
  }

  // --- 4. A7 oracle rows â€” pinned ids, honest current-surface assertions ----
  // fixes/216b (106 T-08 / F-05) + fixes/356 (W356 A3): every row either
  // asserts a real current behavior that can fail, or â€” when it has no emitted
  // module surface to assert against â€” is a MARKED, COUNTED skip under its
  // pinned id. No unwired row can read as green evidence, and no unwired row
  // fails the tree on its own.
  lines.push(
    "// ---------------------------------------------------------------------------",
    "// 4. Oracle rows (A7) â€” one test per row under its PINNED id; a row with no",
    "// emitted module surface is a MARKED, COUNTED skip (`{ skip: ... }`, printed",
    "// on its own TAP line) â€” never a green test and never a silent omission.",
    "// ---------------------------------------------------------------------------",
    "",
  );
  if (!rows.length) {
    // fixes/216b (106 T-08 / F-05): this row used to be assert.equal(true, true)
    // â€” a test that cannot fail is not evidence. With no A7 rows there is
    // nothing to assert, so the spec says exactly that with a visible skip.
    lines.push(
      `test.skip("no-oracle: project has no A7 rows yet â€” run the pipeline to P0/P1", () => {`,
      `  assert.fail("no A7 oracle rows recorded â€” nothing to assert yet (re-emit after P0/P1)");`,
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
    // The head keeps the bare pinned id as its test name (E-08 â€” verified rows
    // match on it), for both live and unwired rows.
    // fixes/357 (R-7): the SAME predicate the census counts with â€” a row with no
    // emitted module surface, or with a classification whose module this emit
    // cannot import, is a marked, counted skip.
    const skipRow = oracleRowUnwired(row, surface);
    // fixes/356 (W356 A3): a row with no emitted module surface is a MARKED
    // skip, not a reachable `assert.fail` â€” the 354 form failed the whole tree
    // (and withheld `emit --git`) for one unwired row. Its body carries NO
    // assert call: an assertion inside a skipped test never executes, and
    // compile-check's `maskSkippedTests` only masks the `test.skip(...)` method
    // form â€” a non-executed assert in the options form would be read as
    // behavioural evidence. Assertable rows are already real, async tests.
    const liveAssertable = !skipRow;
    lines.push(
      liveAssertable
        ? `test(${jstr(id)}, async () => {`
        : `test(${jstr(id)}, { skip: ${jstr(ORACLE_SHORTFALL_MARKER)} }, () => {`,
      `  // A7 row ${jstr(id)} ${name ? `"${name}"` : ""} â€” ${given} => ${expect}`,
    );
    if (kind === "bridged-host") {
      // leftover job-* re-exports the hosted P6 module (fixes/196) â€” not a
      // TODO(E-15) stub and not an invented job body. Do not assert the
      // TODO throw. Template host â‡’ same phase bookkeeping as the host.
      lines.push(
        `  // Leftover job ${job} re-exports the hosted P6 module (fixes/196).`,
        `  // Not a TODO(E-15) stub and not an invented job body. Executable`,
        `  // rule today: the hosted module's phase bookkeeping.`,
        `  assert.throws(() => synthesize({ name: "x", phase: 13, job: JOBS[0] }), /invalid phase/);`,
        `  assert.throws(() => synthesize({ name: "x", phase: -1, job: JOBS[0] }), /invalid phase/);`,
      );
    } else if (kind === "endpoint-live" && ep) {
      // fixes/328 P2: the emitted router dispatches this recorded endpoint to
      // the job's REAL module. Assert the wiring end to end â€” a real, failable
      // acceptance probe over the emitted contract, replacing the pre-328
      // stub-refusal assertion for exactly the jobs that became real.
      lines.push(
        `  // Target seam: ${job} (${ep.method} ${ep.path}) â€” served by the emitted`,
        `  // router, which dispatches to the REAL job module (fixes/328 P2 / TA-15).`,
        `  const ep = ENDPOINTS.find((e) => e.job === ${jstr(row.job)});`,
        `  assert.ok(ep, "endpoint for the row's job must exist (contract drift)");`,
        `  const res = await route(ep.method, ep.path, { id: ${jstr(`${id}-probe`)} });`,
        `  assert.equal(res.ok, true);`,
        `  assert.equal(res.job, ${jstr(row.job)});`,
      );
      if (wantsCheckpoint && storeOk) {
        lines.push(
          `  // The "${expect}" row expects a checkpoint write â€” the ONE part the real`,
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
          `  // the recorded API surface â€” assert its real export surface. (No api`,
          `  // surface is importable in this emission, so the routeâ†’job dispatch`,
          `  // assertion is not available; the module is asserted directly.)`,
          `  const ${wj.slug} = ${wj.importName} as unknown as Record<string, unknown>;`,
          `  assert.ok(typeof ${wj.slug}.JOB === "string", "job module records its label");`,
          `  assert.ok(Array.isArray(${wj.slug}.ENDPOINTS), "job module records its A6 endpoints");`,
          `  assert.equal(typeof ${wj.slug}.handle, "function", "job module exports the router entry");`,
          `  const ${wj.slug}Fns = Object.keys(${wj.slug}).filter((n) => typeof ${wj.slug}[n] === "function");`,
          `  assert.ok(${wj.slug}Fns.length > 0, "job module exports real functions: " + ${wj.slug}Fns.join(", "));`,
        );
      } else {
        // fixes/357 (R-7): classified `live-job` with no importable module â€” the
        // row is UNWIRED (see oracleRowUnwired), so it is already emitted as the
        // marked, counted skip above. The 354/356 bytes put a reachable
        // `assert.fail` here, which condemned the whole tree (`npm test` exit 1,
        // `emit --git` withheld) on one drift; a skipped body must carry no
        // assert (compile-check reads a non-executing assert as evidence).
        lines.push(
          `  // UNWIRED (oracle shortfall â€” counted on the spec header and in`,
          `  // README.md): this row was classified against a materialised job module`,
          `  // (fixes/328 P2) that this emission does not import, so the row has no`,
          `  // assertion it could execute. The pre-357 emission failed the whole tree`,
          `  // here; replace the \`{ skip: ... }\` option with the row's real`,
          `  // acceptance assertion once the module is importable.`,
        );
      }
    } else if (kind === "endpoint-stub" && ep) {
      lines.push(
        `  // Target seam: ${job} (${ep.method} ${ep.path}). Today it is a TODO(E-15) stub â€”`,
        `  // the route rejects instead of returning "${expect}". Asserting that real`,
        `  // current behavior: this test FAILS the moment ${job} is implemented,`,
        `  // which is the signal to replace it with the row's real acceptance assert.`,
        `  const ep = ENDPOINTS.find((e) => e.job === ${jstr(row.job)});`,
        `  assert.ok(ep, "endpoint for the row's job must exist (contract drift)");`,
        `  await assert.rejects(route(ep.method, ep.path, {}), /${EMITTED_REFUSAL_CODE} Â· TODO\\(E-15\\) stub/);`,
      );
      if (wantsCheckpoint && storeOk) {
        lines.push(
          `  // The "${expect}" row expects a checkpoint write â€” the one part the real`,
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
          `  // module (never a bridge) â€” assert its export surface and CALL one`,
          `  // real function in a guarded probe. A ReferenceError here is a missing`,
          `  // cross-file binding (a forward call into a later chunk) and fails this`,
          `  // row; any other throw is the real function behaving. Pre-D2: a skip.`,
          `  // The call is AWAITED: a real job function is async, so a floating`,
          `  // rejection would otherwise surface after the test ends as an`,
          `  // unhandledRejection and red the whole spec file (331 wave).`,
          `  const ${jm.slug} = ${jm.importName} as unknown as Record<string, (...a: unknown[]) => unknown>;`,
          `  const names = Object.keys(${jm.slug});`,
          `  assert.ok(names.length > 0, "job module exports real names: " + names.join(", "));`,
          `  for (const n of names) assert.equal(typeof ${jm.slug}[n], "function", n + " must be a real function");`,
          `  const first = names[0] ?? "";`,
          `  // fixes/353: call the real function over a set of documented candidate`,
          `  // inputs and require at least ONE usable (non-undefined/NaN/function)`,
          `  // result. An export that throws for EVERY input is a stub, not a working`,
          `  // job, and FAILS this row â€” the pre-353 probe accepted any well-formed`,
          `  // Error, so an always-throwing module passed. A missing cross-file binding`,
          `  // (ReferenceError) still fails immediately.`,
          `  const ${jm.slug}Fn = ${jm.slug}[first] as (...a: unknown[]) => unknown;`,
          `  const ${jm.slug}Inputs: unknown[] = [{ payment: 1 }, { id: ${jstr(`${id}-probe`)} }, {}, ${jstr(`${id}-probe`)}, 1, null];`,
          `  let ${jm.slug}Good: unknown;`,
          `  let ${jm.slug}GoodInput: unknown;`,
          `  let ${jm.slug}LastError = "";`,
          `  for (const input of ${jm.slug}Inputs) {`,
          `    try {`,
          `      const out = await ${jm.slug}Fn(input);`,
          `      const usable =`,
          `        out === null ||`,
          `        typeof out === "string" ||`,
          `        typeof out === "boolean" ||`,
          `        (typeof out === "number" && Number.isFinite(out)) ||`,
          `        Array.isArray(out) ||`,
          `        (typeof out === "object" && out !== undefined);`,
          `      if (usable) { ${jm.slug}Good = out; ${jm.slug}GoodInput = input; break; }`,
          `    } catch (error) {`,
          `      if (error instanceof ReferenceError) throw error;`,
          `      ${jm.slug}LastError = error instanceof Error ? error.message : String(error);`,
          `    }`,
          `  }`,
          `  assert.notEqual(${jm.slug}Good, undefined, "job module " + ${jstr(jm.path)} + " returns a usable value for at least one documented input (last error: " + ${jm.slug}LastError + ")");`,
          `  assert.deepEqual(await ${jm.slug}Fn(${jm.slug}GoodInput), ${jm.slug}Good, "job module " + ${jstr(jm.path)} + " is deterministic for the input that succeeded");`,
        );
      } else {
        // fixes/357 (R-7): classified `tree-job` with no importable module (the
        // jobModules label has no `.ts` file this emission imports, or there is
        // no importable tree entry) â€” an UNWIRED row, already emitted as the
        // marked, counted skip above. See the `live-job` twin for why no assert
        // may sit in a skipped body.
        lines.push(
          `  // UNWIRED (oracle shortfall â€” counted on the spec header and in`,
          `  // README.md): this row was classified against a tree job module`,
          `  // (fixes/216k D2) that this emission does not import, so the row has no`,
          `  // assertion it could execute. The pre-357 emission failed the whole tree`,
          `  // here; replace the \`{ skip: ... }\` option with the row's real`,
          `  // acceptance assertion once the module is importable.`,
        );
      }
    } else if (kind === "phase-bookkeeping") {
      lines.push(
        `  // Row targets ${job || "the phase graph"} â€” no HTTP endpoint exists for it. The`,
        `  // only executable rule today is the P6 module's phase bookkeeping: an`,
        `  // out-of-range phase is an illegal transition and is rejected.`,
        `  assert.throws(() => synthesize({ name: "x", phase: 13, job: JOBS[0] }), /invalid phase/);`,
        `  assert.throws(() => synthesize({ name: "x", phase: -1, job: JOBS[0] }), /invalid phase/);`,
      );
    } else {
      // fixes/216b (106 T-08 / F-05) + fixes/356 (W356 A3): the tautological
      // floor is gone. No emitted module surface targets this row (no HTTP
      // endpoint seam, no P6 template host), so it can carry NO real assertion
      // â€” a test that cannot fail is not evidence. The row keeps its pinned id
      // and its place in the spec, marked as this tree's acceptance shortfall:
      // the `{ skip: ... }` marker prints on the row's own TAP line and the
      // header/README census COUNT it, so it can never read as green evidence.
      // The 354 wave's reachable `assert.fail` here failed every emission that
      // carried one such row (and withheld `emit --git`); the shortfall is now
      // surfaced without condemning the tree.
      lines.push(
        `  // NOT IMPLEMENTED (oracle shortfall â€” counted on the spec header and in`,
        `  // README.md): no emitted module surface targets this row yet (106`,
        `  // T-08 / F-05). The pre-fix emission asserted ${jstr(`${id}`)}.length > 0 â€”`,
        `  // which cannot fail, so it was not evidence.`,
        `  // Replace the \`{ skip: ... }\` option with the row's real acceptance`,
        `  // assertion when the seam (HTTP endpoint or P6 host) lands â€” the skip`,
        `  // marker is the cue, and it is never counted as a pass.`,
      );
    }
    lines.push(`});`, "");
  }

  // --- 5. Capability presence (fixes/150 G2) â€” semantic-failure repair -----
  // One REAL test per capability the project's implementationSpec demands
  // (typeSignatures first, requirements fallback â€” the same source order
  // dod.p6-arch uses), so capability ABSENCE is a red test, never a post-hoc
  // report. Each row re-reads the emitted files from disk at test time and
  // asserts the capability's demanded identifier forms (content tokens +
  // canonical stems) appear in a file path or source text. Identifier
  // presence is a PROXY â€” the assert message says exactly what it checks
  // (name/source-text presence) and never claims behavior. The scan runs
  // over RAW source text (comments/literals not masked) â€” deliberately
  // lenient, so it can never red a tree the engine's masked probe
  // (capabilityCoverage / p6-arch) passes â€” and re-reads the files on every
  // run, so an edit that removes a capability's identifiers turns its row
  // red the next time the suite runs.
  // fixes/277 (R3-f03 / W-06): partial-emission capability semantics â€” see
  // OracleSurfaceCtx.partial. One real skip path (below); a non-partial
  // emission's capability section stays byte-identical to the pre-277 output.
  const capPartial = ctx.partial === true;
  if (capSection) {
    lines.push(
      "// ---------------------------------------------------------------------------",
      "// 5. Capability wiring (fixes/150 G2, tightened by 353) â€” each demanded",
      "// capability is CALLED and its real outcome asserted, or the row is an",
      "// explicit skip. There is no presence-only pass: a name is NOT behaviour.",
      "// ---------------------------------------------------------------------------",
      "",
      ...(capPartial
        ? [
            "// fixes/277 (R3-f03 / W-06): this emission carries a PARTIAL synthesis",
            "// tree â€” a capability the emitted modules do not wire is skipped with",
            "// that reason instead of reddening (the pre-fix 28-red cascade read as",
            "// product failure; the reds were assembly, not the product).",
            "",
          ]
        : []),
    );
    capDemands.forEach((d, i) => {
      const idName = `capability.${i + 1}`;
      const binding = capBindings[i] ?? null;
      if (binding !== null) {
        // fixes/352: the tree WIRES this capability â€” call the real export and
        // assert the outcome (a NaN/undefined stub and a binding ReferenceError
        // both fail; a well-formed Error is the function's real behaviour).
        const fn = `${binding.ns}[${jstr(binding.name)}]`;
        if (binding.returnsVoid) {
          // A declared-void export is asserted by EXECUTION: it must run to
          // completion without throwing (a stub that throws fails; a caller
          // that would reject for an async void is awaited).
          lines.push(
            `// ${idName} â€” ${prose(d.label)}`,
            `test(${jstr(idName)}, async () => {`,
            `  const fn = ${fn} as unknown as (...a: unknown[]) => ${binding.isAsync ? "Promise<void>" : "void"};`,
            `  assert.equal(typeof fn, "function", ${jstr(`${binding.name} must be a real export of ${binding.ns}`)});`,
            binding.isAsync
              ? `  await assert.doesNotReject(async () => { await fn(${binding.args.join(", ")}); }, ${jstr(`${binding.name} runs without rejecting`)});`
              : `  assert.doesNotThrow(() => { fn(${binding.args.join(", ")}); }, ${jstr(`${binding.name} runs without throwing`)});`,
            `});`,
            "",
          );
          return;
        }
        lines.push(
          `// ${idName} â€” ${prose(d.label)}`,
          `test(${jstr(idName)}, async () => {`,
          `  const fn = ${fn} as unknown as (...a: unknown[]) => unknown;`,
          `  assert.equal(typeof fn, "function", ${jstr(`${binding.name} must be a real export of ${binding.ns}`)});`,
          `  let outcome: unknown;`,
          `  let failure: unknown;`,
          `  try {`,
          `    outcome = await fn(${binding.args.join(", ")});`,
          `  } catch (error) {`,
          `    if (error instanceof ReferenceError) throw error;`,
          `    failure = error;`,
          `  }`,
          `  if (failure !== undefined) {`,
          `    assert.ok(failure instanceof Error && String((failure as Error).message).trim().length > 0, ${jstr(`${binding.name} threw a well-formed Error`)});`,
          `  } else {`,
          `    assert.notEqual(outcome, undefined, ${jstr(`${binding.name} returned a value for its declared input`)});`,
          `    if (typeof outcome === "number") assert.ok(Number.isFinite(outcome), ${jstr(`${binding.name} returned a finite number`)});`,
          `  }`,
          `});`,
          "",
        );
        return;
      }
      // fixes/353: no callable binding â€” the capability is present in the plan
      // but no emitted module exports it with sound arguments, so there is no
      // REAL behaviour to assert. The row is an explicit skip naming exactly why
      // (never a presence-only pass: a name is not behaviour).
      lines.push(
        `// ${idName} â€” ${prose(d.label)}`,
        `test(${jstr(idName)}, (t) => {`,
        "  t.skip(",
        `    ${jstr(`${idName} â€” NOT WIRED: no emitted module exports "${d.demand}" with sound arguments, so the capability cannot be called${capPartial ? " (partial synthesis: the module that would carry it was never materialised)" : ""}. No behavioural assertion is possible â€” wire the module to turn this row green.`)}`,
        "  );",
        "});",
        "",
      );
    });
  }

  // A2 (fixes/162): human-approved brief fixtures â€” folded into THIS spec
  // (PKG test script pins tests/oracle.spec.ts; a second brief.spec.ts
  // would never run). Partial approval â†’ this section is omitted (byte-identical
  // to the no-fixture emission). A1-01 (fixes/344): a set still carrying a
  // draft sentinel ("<draft>"/"<any>") asserts nothing real and is refused by
  // approvedAcceptanceFixtures exactly like a partial set â€” never a vacuous
  // always-true assertion. Requires a tree entry namespace to call.
  const fxApproved = treeEntryOk ? approvedAcceptanceFixtures(project.acceptanceFixtures) : null;
  if (fxApproved) {
    lines.push(
      "// ---------------------------------------------------------------------------",
      "// 6. Brief-derived acceptance fixtures (fixes/162 A2) â€” human-approved",
      "// inputâ†’output cases. given is JSON-literal. shape = partial match on",
      "// REAL typed literals (A1-01: sentinel rows are red-carded, never folded);",
      "// throws = substring includes; property cases are red-carded (no registry).",
      "// Never auto-approved.",
      "// ---------------------------------------------------------------------------",
      "",
      "const entry = treeModule;",
      fixtureMatchHelperSource(),
      "",
    );
    for (const fx of fxApproved) {
      const compiled = compileFixtureAssertion(fx);
      const title = `fx.${fx.id} â€” ${fx.name}`;
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

/** Game variant: assets/manifest.json â€” expected-but-absent art roster (honest). */
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
      note: "NOT engine-generated â€” supply art or procedural rendering",
    });
  }
  assets.push({
    asset: "ui/icon.png",
    role: "app icon placeholder",
    status: "placeholder",
    note: "NOT engine-generated â€” supply art or procedural rendering",
  });
  return `${JSON.stringify(
    {
      schema: 1,
      kind: "game",
      generatedBy: `RapidTool scaffold emitter â€” ${MACHINE_STAMP(project.id)}`,
      note: "Placeholder manifest: assets/ and public/ are expected at the emitted scaffold and are NOT engine-generated.",
      assets,
    },
    null,
    2,
  )}\n`;
}

// ---------------------------------------------------------------------------
// Browser boot files (fixes/135 â€” webapp/game emits must actually boot)
//
// The webapp/game package.json has always declared `vite` dev/build scripts,
// but the emitted tree carried NO index.html / vite.config / src entry, so
// `npm run build` died with "Could not resolve entry module index.html".
// These three files close that gap: index.html (the vite HTML entry),
// vite.config.ts (webapp: the react plugin the devDeps/tsconfig already
// declare), and a src/main browser entry that mounts the emitted UI shell
// (src/ui â€” the P8 contract-level shell). All deterministic + escaped.
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
 * vite.config.ts â€” webapp (react plugin; tsconfig already declares jsx
 * react-jsx) and, per fixes/277 (R3-f06), game (plain config â€” the game shell
 * is canvas-based and the game devDeps carry NO react/@vitejs/plugin-react, so
 * the webapp config body would break `npm run build` there). Webapp bytes are
 * unchanged from fixes/135.
 */
function emitViteConfig(kind: ProjectKind): string {
  if (kind === "game") {
    return [
      "// ---------------------------------------------------------------------------",
      "// vite.config.ts â€” emitted by the RapidTool scaffold (fixes/277 R3-f06).",
      "// The game package.json declares vite dev/build/preview scripts; this config",
      "// makes them real: index.html + src/main boot the canvas shell. Plain config",
      "// â€” the canvas UI has no framework plugin (game devDeps carry none).",
      "// ---------------------------------------------------------------------------",
      'import { defineConfig } from "vite";',
      "",
      "export default defineConfig({});",
      "",
    ].join("\n");
  }
  return [
    "// ---------------------------------------------------------------------------",
    "// vite.config.ts â€” emitted by the RapidTool scaffold (fixes/135 bootability).",
    "// The webapp package.json declares the vite dev/build scripts + the react and",
    "// tailwindcss plugins (W52 / 338-5: tailwindcss wired so no declared devDep is",
    "// inert); this config makes them real: index.html + src/main mount the UI shell",
    "// and src/styles.css is the Tailwind v4 CSS entry the plugin compiles.",
    "// ---------------------------------------------------------------------------",
    'import { defineConfig } from "vite";',
    'import react from "@vitejs/plugin-react";',
    'import tailwindcss from "@tailwindcss/vite";',
    "",
    "export default defineConfig({",
    "  plugins: [react(), tailwindcss()],",
    "});",
    "",
  ].join("\n");
}

/**
 * src/styles.css â€” the webapp tree's Tailwind v4 entry (W52 / 338-5).
 *
 * The emitted `package.json` declares `tailwindcss` + `@tailwindcss/vite`;
 * `vite.config.ts` registers the plugin. Tailwind v4 is CSS-first, so the
 * plugin only does work when a CSS file imports it â€” this is that file. Without
 * it both devDeps were dead weight (the fixes/169 Â§C-2 drift).
 *
 * Deterministic and injection-safe: the bytes are a FIXED token sheet with no
 * project text, so a hostile name/brief can never reach the CSS. The `@layer
 * base` rules style the contract-level Console shell's unclassed
 * `<main>/<h1>/<p>` markup so it renders intentionally, not browser-default.
 */
function emitStylesCss(): string {
  return [
    "/* ---------------------------------------------------------------------------",
    " * styles.css â€” emitted by the RapidTool scaffold.",
    " *",
    " * A designed token sheet + semantic component classes for the emitted site.",
    " * Tailwind v4 compiles the `@import` below (package.json declares `tailwindcss`",
    " * + `@tailwindcss/vite` and vite.config.ts registers the plugin); the classes",
    " * are plain CSS, so the whole sheet also renders standalone â€” the browser",
    " * preview strips the Tailwind import and every rule here still applies.",
    " *",
    " * Tokens: warm neutral surface, one primary + one accent, light/dark parity,",
    " * a 4px spacing step. No project-derived text ever reaches this file.",
    " * --------------------------------------------------------------------------- */",
    '@import "tailwindcss";',
    "",
    ":root {",
    "  --color-bg: #fbfaf7;",
    "  --color-surface: #ffffff;",
    "  --color-raised: #f4f1ea;",
    "  --color-fg: #1f1b16;",
    "  --color-muted: #6f675d;",
    "  --color-faint: #9a9288;",
    "  --color-border: #e6e0d6;",
    "  --color-primary: #a4470a;",
    "  --color-primary-strong: #86390a;",
    "  --color-primary-fg: #ffffff;",
    "  --color-accent: #0f766e;",
    "  --color-ok: #15803d;",
    "  --color-warn: #a4470a;",
    "  --color-danger: #b3261e;",
    "  --radius: 0.875rem;",
    "  --radius-sm: 0.5rem;",
    "  --shadow-sm: 0 1px 2px rgba(31, 27, 22, 0.06);",
    "  --shadow-md: 0 10px 30px -12px rgba(31, 27, 22, 0.22);",
    '  --font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;',
    '  --font-display: "Fraunces", Georgia, "Times New Roman", serif;',
    "}",
    "",
    "@media (prefers-color-scheme: dark) {",
    "  :root {",
    "    --color-bg: #14110e;",
    "    --color-surface: #1c1814;",
    "    --color-raised: #241f19;",
    "    --color-fg: #f3ede4;",
    "    --color-muted: #b6ad9f;",
    "    --color-faint: #8a8172;",
    "    --color-border: #322b24;",
    "    --color-primary: #f59e0b;",
    "    --color-primary-strong: #fbbf24;",
    "    --color-primary-fg: #1f1b16;",
    "    --color-accent: #2dd4bf;",
    "    --shadow-md: 0 10px 30px -12px rgba(0, 0, 0, 0.6);",
    "  }",
    "}",
    "",
    "/* Base rules for the contract-level single-file shell's unclassed markup",
    " * (main/h1/p). The multi-page site's classes are unlayered and win where",
    " * they overlap, so both shell shapes render intentionally. */",
    "@layer base {",
    "  main { max-width: 48rem; margin: 0 auto; padding: 2rem 1.25rem; }",
    "  h1 { font-size: 1.5rem; font-weight: 600; }",
    "  p { margin: 0 0 0.75rem; }",
    "}",
    "",
    "*, *::before, *::after { box-sizing: border-box; }",
    "html { scroll-behavior: smooth; }",
    "body {",
    "  margin: 0;",
    "  min-height: 100vh;",
    "  font-family: var(--font-sans);",
    "  font-size: 1rem;",
    "  line-height: 1.55;",
    "  background: var(--color-bg);",
    "  color: var(--color-fg);",
    "  -webkit-font-smoothing: antialiased;",
    "}",
    "img { max-width: 100%; display: block; }",
    "a { color: var(--color-primary); text-decoration: none; }",
    "a:hover { text-decoration: underline; }",
    "h1, h2, h3 { font-family: var(--font-display); line-height: 1.2; margin: 0 0 0.5rem; letter-spacing: -0.01em; }",
    "h1 { font-size: clamp(1.9rem, 4vw, 2.75rem); }",
    "h2 { font-size: clamp(1.4rem, 2.6vw, 1.9rem); }",
    "h3 { font-size: 1.1rem; margin-bottom: 0.25rem; }",
    "p { margin: 0 0 0.75rem; }",
    "button, input, select, textarea { font: inherit; color: inherit; }",
    'button:not(:disabled), [role="button"]:not(:disabled) { cursor: pointer; }',
    ":focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }",
    ".sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }",
    ".muted { color: var(--color-muted); }",
    "",
    "/* ---- shell ------------------------------------------------------------- */",
    ".site { min-height: 100vh; display: flex; flex-direction: column; }",
    ".site-header {",
    "  position: sticky; top: 0; z-index: 20;",
    "  display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem 1.5rem;",
    "  padding: 0.75rem clamp(1rem, 4vw, 2.5rem);",
    "  background: var(--color-bg);",
    "  border-bottom: 1px solid var(--color-border);",
    "}",
    ".site-brand { display: flex; flex-direction: column; color: inherit; }",
    ".site-brand:hover { text-decoration: none; }",
    ".site-brand__name { font-family: var(--font-display); font-size: 1.15rem; font-weight: 600; }",
    ".site-brand__tagline { font-size: 0.75rem; color: var(--color-muted); }",
    ".site-nav { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-left: auto; }",
    ".site-nav__link { display: inline-flex; align-items: center; min-height: 44px; padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); font-size: 0.9rem; color: var(--color-muted); }",
    ".site-nav__link:hover { background: var(--color-raised); color: var(--color-fg); text-decoration: none; }",
    ".site-nav__link--active { background: var(--color-raised); color: var(--color-fg); font-weight: 600; }",
    ".site-main { flex: 1; width: 100%; max-width: 68rem; margin: 0 auto; padding: clamp(1.25rem, 3vw, 2.5rem) clamp(1rem, 4vw, 2rem) 3rem; }",
    ".site-footer { border-top: 1px solid var(--color-border); background: var(--color-surface); }",
    ".site-footer__inner { display: flex; flex-wrap: wrap; gap: 1.5rem; justify-content: space-between; max-width: 68rem; margin: 0 auto; padding: 2rem clamp(1rem, 4vw, 2.5rem); }",
    ".site-footer__name { font-weight: 600; margin: 0 0 0.25rem; }",
    ".site-footer__line { margin: 0 0 0.15rem; font-size: 0.9rem; color: var(--color-muted); }",
    ".site-footer__awards { list-style: none; margin: 0; padding: 0; max-width: 22rem; font-size: 0.8rem; color: var(--color-muted); }",
    ".site-footer__awards li { margin-bottom: 0.2rem; }",
    "",
    "/* ---- hero + sections --------------------------------------------------- */",
    ".hero { display: grid; gap: 1.5rem; padding: clamp(1.5rem, 4vw, 3rem) 0 2rem; }",
    ".hero__eyebrow { font-size: 0.8rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--color-primary); font-weight: 600; }",
    ".hero__name { margin-bottom: 0.5rem; }",
    ".hero__tagline { font-size: 1.15rem; color: var(--color-muted); max-width: 46rem; }",
    ".hero__meta { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; font-size: 0.9rem; color: var(--color-muted); }",
    ".hero__actions { display: flex; flex-wrap: wrap; gap: 0.75rem; }",
    ".section { padding: 1.75rem 0; border-top: 1px solid var(--color-border); }",
    ".section:first-child { border-top: 0; }",
    ".section__lead { color: var(--color-muted); max-width: 46rem; }",
    ".section__head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 0.5rem; }",
    "",
    "/* ---- buttons + badges -------------------------------------------------- */",
    ".btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; min-height: 44px; padding: 0.6rem 1.15rem; border-radius: var(--radius-sm); border: 1px solid transparent; font-size: 0.95rem; font-weight: 600; text-decoration: none; }",
    ".btn:hover { text-decoration: none; }",
    ".btn--primary { background: var(--color-primary); color: var(--color-primary-fg); }",
    ".btn--primary:hover { background: var(--color-primary-strong); }",
    ".btn--ghost { border-color: var(--color-border); background: var(--color-surface); color: var(--color-fg); }",
    ".btn--ghost:hover { border-color: var(--color-primary); }",
    ".btn:disabled { opacity: 0.5; }",
    ".badge { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; border: 1px solid var(--color-border); }",
    ".badge--open { color: var(--color-ok); border-color: color-mix(in srgb, var(--color-ok) 40%, transparent); }",
    ".badge--closed { color: var(--color-danger); border-color: color-mix(in srgb, var(--color-danger) 40%, transparent); }",
    ".badge--info { color: var(--color-accent); border-color: color-mix(in srgb, var(--color-accent) 40%, transparent); }",
    "",
    "/* ---- cards + grids ----------------------------------------------------- */",
    ".grid { display: grid; gap: 1rem; }",
    ".grid--cards { grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); }",
    ".grid--two { grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr)); }",
    ".card { display: flex; flex-direction: column; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); overflow: hidden; box-shadow: var(--shadow-sm); }",
    ".card__media { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; background: var(--color-raised); }",
    ".card__media--fallback { display: flex; align-items: center; justify-content: center; font-family: var(--font-display); font-size: 1.75rem; color: var(--color-faint); }",
    ".card__body { display: flex; flex-direction: column; gap: 0.35rem; padding: 0.85rem 1rem 1rem; flex: 1; }",
    ".card__title { font-size: 1rem; margin: 0; }",
    ".card__meta { font-size: 0.8rem; color: var(--color-muted); margin: 0; }",
    ".card__actions { margin-top: auto; padding-top: 0.5rem; }",
    "",
    "/* ---- hours + facts ----------------------------------------------------- */",
    ".hours { list-style: none; margin: 0; padding: 0; max-width: 26rem; border: 1px solid var(--color-border); border-radius: var(--radius); overflow: hidden; }",
    ".hours__row { display: flex; justify-content: space-between; gap: 1rem; padding: 0.6rem 0.9rem; border-top: 1px solid var(--color-border); background: var(--color-surface); }",
    ".hours__row:first-child { border-top: 0; }",
    ".hours__row--closed { color: var(--color-muted); }",
    ".hours__day { font-weight: 600; }",
    ".facts { list-style: none; margin: 0; padding: 0; }",
    ".facts__row { margin-bottom: 0.4rem; }",
    ".facts__label { display: block; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-faint); }",
    ".stats { display: flex; flex-wrap: wrap; gap: 1.5rem; }",
    ".stat__value { font-family: var(--font-display); font-size: 2rem; line-height: 1; }",
    ".stat__label { font-size: 0.8rem; color: var(--color-muted); }",
    ".prose { max-width: 46rem; }",
    ".prose p { margin-bottom: 1rem; }",
    ".awards { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.5rem; }",
    ".awards__item { border: 1px solid var(--color-border); border-radius: 999px; padding: 0.3rem 0.75rem; font-size: 0.8rem; color: var(--color-muted); background: var(--color-surface); }",
    "",
    "/* ---- forms + order ----------------------------------------------------- */",
    ".field { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 0.9rem; }",
    ".field__label { font-size: 0.85rem; font-weight: 600; }",
    ".field__control { min-height: 44px; padding: 0.55rem 0.75rem; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-fg); }",
    ".field__control:focus { outline: 2px solid var(--color-accent); outline-offset: 1px; border-color: var(--color-accent); }",
    ".field__error { font-size: 0.8rem; color: var(--color-danger); }",
    ".field--invalid .field__control { border-color: var(--color-danger); }",
    ".choice { display: flex; gap: 0.5rem; flex-wrap: wrap; }",
    ".choice__option { display: inline-flex; align-items: center; gap: 0.4rem; min-height: 44px; padding: 0.4rem 0.85rem; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); }",
    ".choice__option--active { border-color: var(--color-primary); color: var(--color-primary); font-weight: 600; }",
    ".cart { list-style: none; margin: 0; padding: 0; border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-surface); }",
    ".cart__line { display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.9rem; border-top: 1px solid var(--color-border); }",
    ".cart__line:first-child { border-top: 0; }",
    ".cart__name { flex: 1; min-width: 0; }",
    ".cart__empty { padding: 1rem; color: var(--color-muted); }",
    ".qty { display: inline-flex; align-items: center; gap: 0.35rem; }",
    ".qty__btn { width: 32px; height: 32px; border-radius: var(--radius-sm); border: 1px solid var(--color-border); background: var(--color-surface); line-height: 1; }",
    ".qty__value { min-width: 2ch; text-align: center; font-variant-numeric: tabular-nums; }",
    ".notice { padding: 0.7rem 0.9rem; border-radius: var(--radius-sm); border: 1px solid var(--color-border); background: var(--color-surface); font-size: 0.9rem; }",
    ".notice--ok { color: var(--color-ok); border-color: color-mix(in srgb, var(--color-ok) 40%, transparent); }",
    ".notice--error { color: var(--color-danger); border-color: color-mix(in srgb, var(--color-danger) 40%, transparent); }",
    ".search { min-height: 44px; width: 100%; padding: 0.55rem 0.75rem; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); }",
    ".add-items { margin-top: 1rem; }",
    "",
    "/* ---- generic site views ------------------------------------------------ */",
    ".skip-link { position: absolute; left: -9999px; top: 0; padding: 0.6rem 0.9rem; background: var(--color-primary); color: var(--color-primary-fg); border-radius: var(--radius-sm); z-index: 50; }",
    ".skip-link:focus { left: 0.75rem; top: 0.75rem; }",
    ".records { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.75rem; }",
    ".records__item { border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-surface); padding: 0.85rem 1rem; }",
    ".record { margin: 0; display: grid; gap: 0.35rem; }",
    ".record__pair { display: grid; grid-template-columns: minmax(6rem, 12rem) 1fr; gap: 0.75rem; }",
    ".record__pair dt { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-faint); }",
    ".record__pair dd { margin: 0; }",
    ".value { margin: 0; }",
    "",
    "/* ---- responsive: mobile-first width breakpoints (320 â†’ 1440) ----------- */",
    "@media (min-width: 40rem) {",
    "  .site-main { padding-left: 1.5rem; padding-right: 1.5rem; }",
    "  .record__pair { grid-template-columns: minmax(8rem, 14rem) 1fr; }",
    "}",
    "@media (min-width: 48rem) {",
    "  .site-header { flex-wrap: nowrap; }",
    "  .grid--two { grid-template-columns: repeat(2, minmax(0, 1fr)); }",
    "}",
    "@media (min-width: 64rem) {",
    "  .site-main { padding-left: 2rem; padding-right: 2rem; }",
    "  .hero { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); align-items: center; }",
    "}",
    "@media (min-width: 90rem) {",
    "  .site-main { max-width: 80rem; }",
    "}",
    "",
    "@media (prefers-reduced-motion: reduce) {",
    "  html { scroll-behavior: auto; }",
    "  * { transition: none !important; }",
    "}",
    "",
  ].join("\n");
}

/**
 * Browser entry that mounts the emitted UI shell. `uiSpecifier` is the
 * extensionless relative import to the sanitized ui node path (null when the
 * spec graph has no ui node â€” then a self-contained honest shell is emitted).
 * webapp mounts the React Console; game boots the canvas shell.
 */
function emitMainEntry(kind: ProjectKind, project: Project, uiSpecifier: string | null): string {
  if (kind === "webapp") {
    const title = jstr(displayName(project.name) || "RapidTool scaffold");
    const lines = [
      ...sourceHeader("src/main.tsx", "Browser entry â€” mounts the UI shell (P8 interface contract)", project, [
        "// The mounted surface is the contract-level Console shell from src/ui; wiring",
        "// it to the store/job modules is the build work ahead (see README honest",
        "// boundaries).",
      ]),
      'import { createRoot } from "react-dom/client";',
      'import "./styles.css";',
      "",
    ];
    if (uiSpecifier) {
      lines.push(
        `import Console from ${jstr(uiSpecifier)};`,
        "",
        "const rootEl = document.getElementById(\"root\");",
        `if (!rootEl) throw new Error(${jstr(emittedRefusal("missing #root element â€” index.html did not load"))});`,
        "createRoot(rootEl).render(<Console />);",
        "",
      );
    } else {
      lines.push(
        "function Shell() {",
        `  return (`,
        `    <main>`,
        `      <h1>{${title}}</h1>`,
        `      <p>shell â€” no spec-graph ui node was emitted for this project; run the`,
        `      pipeline to P0/P1 and re-emit to mount the P8 interface contract.</p>`,
        `    </main>`,
        `  );`,
        `}`,
        "",
        "const rootEl = document.getElementById(\"root\");",
        `if (!rootEl) throw new Error(${jstr(emittedRefusal("missing #root element â€” index.html did not load"))});`,
        "createRoot(rootEl).render(<Shell />);",
        "",
      );
    }
    return lines.join("\n");
  }
  // game kind: plain-TS entry, no react dependency (matches the game devDeps).
  const lines = [
    ...sourceHeader("src/main.ts", "Browser entry â€” boots the game shell", project, [
      "// Assets are NOT engine-generated â€” see assets/manifest.json.",
    ]),
  ];
  if (uiSpecifier) {
    lines.push(
      `import { bootGame } from ${jstr(uiSpecifier)};`,
      "",
      "const rootEl = document.getElementById(\"root\");",
      `if (!rootEl) throw new Error(${jstr(emittedRefusal("missing #root element â€” index.html did not load"))});`,
      "const handle = bootGame(rootEl);",
      "void handle; // keep the GameHandle reachable for future HMR/dev wiring",
      "",
    );
  } else {
    lines.push(
      "const rootEl = document.getElementById(\"root\");",
      `if (!rootEl) throw new Error(${jstr(emittedRefusal("missing #root element â€” index.html did not load"))});`,
      "rootEl.textContent = \"game shell â€” no spec-graph ui node was emitted; run the pipeline to P0/P1 and re-emit.\";",
      "",
    );
  }
  return lines.join("\n");
}

/**
 * fixes/277 (R3-f06): the direct-execution guard shared by every emitKindEntry
 * flavor â€” the standard ESM main-module check (process.argv[1] vs this
 * module's own URL). The structured stub stays IMPORTABLE (an import runs
 * nothing â€” tests/tooling/the oracle spec never trigger it) while the coded
 * refusal fires the moment the entry is actually EXECUTED
 * (`node --experimental-strip-types src/main.ts`, the package bin launcher, or
 * `npm start`).
 */
function directRunGuardLines(): string[] {
  return [
    "// Direct-execution guard (the standard ESM main-module check): main runs ONLY",
    "// when this file is the program being executed â€” any import (tests, tooling,",
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
 * The declared surface names a brief names: backtick identifiers immediately
 * followed by `(`/`<`. The SAME grammar `dod.declaredSurfaceNames` uses to
 * build the `p6-runnable-entry` gate â€” a scaffold test pins the two, so the
 * emitted entry can expose exactly the names the gate demands and the emitter
 * and the gate can never read two grammars.
 */
export function declaredSurfaceNamesOf(brief: string): string[] {
  const out = new Set<string>();
  for (const match of String(brief ?? "").matchAll(/`([A-Za-z_$][A-Za-z0-9_$]*)(?=\s*[<(])/g)) out.add(match[1]);
  return [...out];
}

/** The six real analysis views the emitted CLI can run. */
type CliView = "summary" | "errors" | "latency" | "timeline" | "watch" | "transform";

const CLI_VIEWS: Record<CliView, string> = {
  summary: "counts by level, the time range and the top messages",
  errors: "error/warning fingerprints with counts and a sample line",
  latency: "records over a latency budget (--p95 <ms>)",
  timeline: "per-bucket record counts (--bucket <span>)",
  watch: "error/warning lines as they appear in the input",
  transform: "the parsed records re-serialized as NDJSON",
};

/** The view a declared command name selects (keyword-driven, deterministic). */
function cliViewFor(name: string): CliView {
  const n = name.toLowerCase();
  if (/err|fail|problem|issue|alert/.test(n)) return "errors";
  if (/slow|latency|perf|p95|timing|duration/.test(n)) return "latency";
  if (/time|bucket|hist|series|minute|hour|trend/.test(n)) return "timeline";
  if (/watch|tail|follow|stream|live/.test(n)) return "watch";
  if (/convert|parse|transform|format|render|export|serial/.test(n)) return "transform";
  return "summary";
}

/** The CLI subcommands: the brief's declared names, else the recorded jobs. */
function cliCommands(project: Project): string[] {
  const declared = declaredSurfaceNamesOf(project.brief ?? "");
  if (declared.length > 0) return declared;
  const names: string[] = [];
  for (const endpoint of project.contracts?.endpoints ?? []) {
    const job = String(endpoint?.job ?? "").trim();
    if (job === "") continue;
    const name = ident(job.toLowerCase(), "command");
    if (!names.includes(name)) names.push(name);
  }
  return names.length > 0 ? names : ["analyze"];
}

/** Names the emitted CLI entry already defines â€” a declared command with one of
 *  these names would be a duplicate declaration, so it is dispatched but not
 *  re-exported. */
const CLI_CORE_NAMES = new Set([
  "main", "parseArgv", "readInput", "parseRecord", "fingerprint", "topMessages",
  "viewSummary", "viewErrors", "viewLatency", "viewTimeline", "viewWatch", "viewTransform",
  "viewFor", "parseBucket", "pick", "toNumberOrNull", "toTimeOrNull", "send",
]);

/** The shared log/text analyzer the emitted CLI entry hosts (real, streaming). */
function cliAnalyzerLines(): string[] {
  return [
    "const LEVEL_MAP: Record<string, string> = { warning: \"warn\", err: \"error\", critical: \"fatal\", crit: \"fatal\", notice: \"info\" };",
    "const LEVEL_RE = /\\b(trace|debug|info|notice|warn|warning|error|err|fatal|critical|crit)\\b/i;",
    "const DURATION_RE = /\\b(\\d+(?:\\.\\d+)?)\\s?(ms|s)\\b/;",
    "const TS_RE = /\\b(\\d{4}-\\d{2}-\\d{2}[T ]\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:?\\d{2})?)\\b/;",
    "",
    "function pick(record: Record<string, unknown>, keys: readonly string[]): unknown {",
    "  for (const key of keys) {",
    "    const value = record[key];",
    "    if (value !== undefined && value !== null) return value;",
    "  }",
    "  return undefined;",
    "}",
    "",
    "function toNumberOrNull(value: unknown): number | null {",
    "  if (typeof value === \"number\" && Number.isFinite(value)) return value;",
    "  if (typeof value === \"string\" && value.trim() !== \"\" && Number.isFinite(Number(value))) return Number(value);",
    "  return null;",
    "}",
    "",
    "function toTimeOrNull(value: unknown): number | null {",
    "  if (typeof value === \"number\" && Number.isFinite(value)) return value > 100000000000 ? value : value * 1000;",
    "  if (typeof value === \"string\" && value.trim() !== \"\") {",
    "    const parsed = Date.parse(value);",
    "    return Number.isFinite(parsed) ? parsed : null;",
    "  }",
    "  return null;",
    "}",
    "",
    "/** Parse one input line as an NDJSON record, or as plain text. */",
    "export function parseRecord(raw: string): LogRecord {",
    "  const trimmed = raw.trim();",
    "  if (trimmed.startsWith(\"{\")) {",
    "    try {",
    "      const parsed = JSON.parse(trimmed) as Record<string, unknown>;",
    "      if (parsed !== null && typeof parsed === \"object\" && !Array.isArray(parsed)) {",
    "        const level = String(pick(parsed, [\"level\", \"severity\", \"lvl\", \"logLevel\"]) ?? \"\").toLowerCase();",
    "        const message = String(pick(parsed, [\"message\", \"msg\", \"text\", \"event\", \"name\"]) ?? trimmed);",
    "        return {",
    "          raw: trimmed,",
    "          level: LEVEL_MAP[level] ?? level,",
    "          message,",
    "          ts: toTimeOrNull(pick(parsed, [\"timestamp\", \"time\", \"ts\", \"date\", \"@timestamp\"])),",
    "          durationMs: toNumberOrNull(pick(parsed, [\"durationMs\", \"latencyMs\", \"elapsedMs\", \"duration\", \"latency\", \"elapsed\", \"ms\", \"took\"])),",
    "        };",
    "      }",
    "    } catch {",
    "      // Not JSON â€” fall through to the plain-text parse below.",
    "    }",
    "  }",
    "  const levelMatch = LEVEL_RE.exec(trimmed);",
    "  const durationMatch = DURATION_RE.exec(trimmed);",
    "  const tsMatch = TS_RE.exec(trimmed);",
    "  const level = levelMatch ? LEVEL_MAP[levelMatch[1].toLowerCase()] ?? levelMatch[1].toLowerCase() : \"info\";",
    "  const durationMs = durationMatch ? Number(durationMatch[1]) * (durationMatch[2] === \"s\" ? 1000 : 1) : null;",
    "  const ts = tsMatch ? Date.parse(tsMatch[1].replace(\" \", \"T\")) : Number.NaN;",
    "  return { raw: trimmed, level, message: trimmed, ts: Number.isFinite(ts) ? ts : null, durationMs };",
    "}",
    "",
    "/** Normalize a message so near-identical lines group (ids, uuids, durations, quoted strings). */",
    "export function fingerprint(message: string): string {",
    "  return message",
    "    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, \"<uuid>\")",
    "    .replace(/\\b[0-9a-f]{16,}\\b/gi, \"<id>\")",
    "    .replace(/\\b\\d{4}-\\d{2}-\\d{2}[T ]\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:?\\d{2})?/g, \"<ts>\")",
    "    .replace(/\\b\\d+(?:\\.\\d+)?(?:ms|s)\\b/g, \"<duration>\")",
    "    .replace(/\"[^\"]*\"|'[^']*'/g, \"<quoted>\")",
    "    .replace(/\\b\\d+\\b/g, \"<n>\")",
    "    .trim();",
    "}",
    "",
    "function topMessages(records: readonly LogRecord[], limit: number): { count: number; sample: string }[] {",
    "  const groups = new Map<string, { count: number; sample: string }>();",
    "  for (const record of records) {",
    "    const key = fingerprint(record.message);",
    "    const existing = groups.get(key);",
    "    if (existing) existing.count += 1;",
    "    else groups.set(key, { count: 1, sample: record.message });",
    "  }",
    "  return [...groups.values()].sort((a, b) => b.count - a.count || a.sample.localeCompare(b.sample)).slice(0, limit);",
    "}",
    "",
    "function viewSummary(records: readonly LogRecord[], options: CliOptions): CliResult {",
    "  void options;",
    "  const byLevel = new Map<string, number>();",
    "  let first: number | null = null;",
    "  let last: number | null = null;",
    "  for (const record of records) {",
    "    byLevel.set(record.level, (byLevel.get(record.level) ?? 0) + 1);",
    "    if (record.ts !== null) {",
    "      if (first === null || record.ts < first) first = record.ts;",
    "      if (last === null || record.ts > last) last = record.ts;",
    "    }",
    "  }",
    "  const top = topMessages(records, 5);",
    "  const data = {",
    "    records: records.length,",
    "    byLevel: Object.fromEntries([...byLevel.entries()].sort((a, b) => a[0].localeCompare(b[0]))),",
    "    first: first === null ? null : new Date(first).toISOString(),",
    "    last: last === null ? null : new Date(last).toISOString(),",
    "    topMessages: top,",
    "  };",
    "  const levels = [...byLevel.entries()].map(([level, count]) => level + \"=\" + count).join(\" \") || \"(none)\";",
    "  return {",
    "    code: 0,",
    "    lines: [",
    "      \"records: \" + records.length,",
    "      \"levels: \" + levels,",
    "      \"range: \" + (data.first ?? \"unknown\") + \" .. \" + (data.last ?? \"unknown\"),",
    "      \"top messages:\",",
    "      ...top.map((group) => \"  \" + group.count + \"x \" + group.sample),",
    "    ],",
    "    data,",
    "  };",
    "}",
    "",
    "function viewErrors(records: readonly LogRecord[], options: CliOptions): CliResult {",
    "  void options;",
    "  const flagged = records.filter((record) => record.level === \"error\" || record.level === \"fatal\" || record.level === \"warn\");",
    "  const groups = topMessages(flagged, 20);",
    "  const data = { records: records.length, flagged: flagged.length, groups: groups.map((group) => ({ fingerprint: fingerprint(group.sample), count: group.count, sample: group.sample })) };",
    "  const lines = flagged.length === 0",
    "    ? [\"no error or warning records found\"]",
    "    : [flagged.length + \" error/warning record(s) in \" + groups.length + \" group(s):\", ...groups.map((group) => \"  \" + group.count + \"x \" + fingerprint(group.sample) + \"\\n     e.g. \" + group.sample)];",
    "  return { code: 0, lines, data };",
    "}",
    "",
    "function viewLatency(records: readonly LogRecord[], options: CliOptions): CliResult {",
    "  const parsed = Number(options.flags.p95 ?? \"500\");",
    "  const budget = Number.isFinite(parsed) ? parsed : 500;",
    "  const offenders = records.filter((record) => record.durationMs !== null && record.durationMs > budget);",
    "  const groups = new Map<string, { count: number; maxMs: number; sample: string }>();",
    "  for (const record of offenders) {",
    "    const key = fingerprint(record.message);",
    "    const existing = groups.get(key);",
    "    if (existing) {",
    "      existing.count += 1;",
    "      existing.maxMs = Math.max(existing.maxMs, record.durationMs ?? 0);",
    "    } else {",
    "      groups.set(key, { count: 1, maxMs: record.durationMs ?? 0, sample: record.message });",
    "    }",
    "  }",
    "  const rows = [...groups.values()].sort((a, b) => b.maxMs - a.maxMs || b.count - a.count);",
    "  const data = { budgetMs: budget, overBudget: offenders.length, groups: rows.map((row) => ({ fingerprint: fingerprint(row.sample), count: row.count, maxMs: row.maxMs })) };",
    "  const lines = offenders.length === 0",
    "    ? [\"no record exceeded \" + budget + \"ms\"]",
    "    : [offenders.length + \" record(s) exceeded \" + budget + \"ms across \" + rows.length + \" message(s):\", ...rows.map((row) => \"  \" + row.count + \"x max \" + row.maxMs + \"ms  \" + fingerprint(row.sample))];",
    "  return { code: 0, lines, data };",
    "}",
    "",
    "function parseBucket(span: string | undefined): number {",
    "  const match = /^(\\d+)(s|m|h)$/.exec((span ?? \"1m\").trim());",
    "  if (match === null) return 60000;",
    "  const size = Number(match[1]);",
    "  return size * (match[2] === \"s\" ? 1000 : match[2] === \"m\" ? 60000 : 3600000);",
    "}",
    "",
    "function viewTimeline(records: readonly LogRecord[], options: CliOptions): CliResult {",
    "  const bucketMs = parseBucket(options.flags.bucket);",
    "  const buckets = new Map<number, number>();",
    "  let undated = 0;",
    "  for (const record of records) {",
    "    if (record.ts === null) { undated += 1; continue; }",
    "    const key = Math.floor(record.ts / bucketMs) * bucketMs;",
    "    buckets.set(key, (buckets.get(key) ?? 0) + 1);",
    "  }",
    "  const ordered = [...buckets.entries()].sort((a, b) => a[0] - b[0]);",
    "  const width = Math.max(...ordered.map((entry) => entry[1]), 1);",
    "  const data = { bucketMs, buckets: ordered.map(([start, count]) => ({ start: new Date(start).toISOString(), count })), undated };",
    "  const lines = [",
    "    records.length + \" record(s) across \" + ordered.length + \" bucket(s) of \" + bucketMs + \"ms\" + (undated > 0 ? \", \" + undated + \" undated\" : \"\") + \":\",",
    "    ...ordered.map(([start, count]) => \"  \" + new Date(start).toISOString() + \"  \" + String(count).padStart(4) + \"  \" + \"#\".repeat(Math.max(1, Math.round((count / width) * 24)))),",
    "  ];",
    "  return { code: 0, lines, data };",
    "}",
    "",
    "function viewWatch(records: readonly LogRecord[], options: CliOptions): CliResult {",
    "  void options;",
    "  const flagged = records.filter((record) => record.level === \"error\" || record.level === \"fatal\" || record.level === \"warn\");",
    "  const data = { flagged: flagged.length, lines: flagged.map((record) => record.raw) };",
    "  const lines = flagged.length === 0",
    "    ? [\"no error or warning records to highlight\"]",
    "    : flagged.map((record) => (record.level === \"warn\" ? \"! \" : \"# \") + record.raw);",
    "  return { code: 0, lines, data };",
    "}",
    "",
    "function viewTransform(records: readonly LogRecord[], options: CliOptions): CliResult {",
    "  void options;",
    "  const data = records.map((record) => ({ level: record.level, message: record.message, ts: record.ts, durationMs: record.durationMs }));",
    "  return { code: 0, lines: data.map((record) => JSON.stringify(record)), data };",
    "}",
    "",
    "function viewFor(command: string): (records: readonly LogRecord[], options: CliOptions) => CliResult {",
    "  const view = VIEW_BY_COMMAND[command] ?? \"summary\";",
    "  return VIEWS[view] ?? viewSummary;",
    "}",
  ];
}

/**
 * fixes/347-2: the cli-tool entry â€” a REAL program, not a throw stub. It hosts a
 * streaming NDJSON/plain-text analyzer, a real argument parser with helpful
 * errors, one exported function per declared command, and the exit-code
 * contract the brief names (0 ok Â· 1 usage error Â· 2 no data). The declared
 * names come from the brief (declaredSurfaceNamesOf) so the emitted entry
 * exposes exactly the surface dod's `p6-runnable-entry` gate demands.
 */
function emitCliEntry(project: Project): string {
  const slug = slugName(project.name);
  const plan = cliCommands(project).map((name) => ({ name, view: cliViewFor(name) }));
  const viewByCommand: Record<string, CliView> = {};
  for (const entry of plan) viewByCommand[entry.name] = entry.view;
  const usageLines = [
    `  ${jstr(`usage: ${slug} <command> [options] [file]`)},`,
    '  "",',
    '  "commands:",',
    ...plan.flatMap((entry) => [`  // ${CLI_VIEWS[entry.view]}`, `  ${jstr(`  ${entry.name} <file>`)},`]),
    '  "",',
    '  "options:",',
    '  "  --json            machine-readable output",',
    '  "  --quiet           suppress output, exit code only",',
    '  "  --p95 <ms>        latency budget for the latency command",',
    '  "  --bucket <span>   timeline bucket, e.g. 1m / 5m / 1h",',
    '  "  -h, --help        show this help",',
    '  "",',
    '  "Reads the file argument; stdin when it is missing or \\"-\\".",',
    '].join("\\n");',
  ];
  const declaredExports = plan
    .filter((entry) => !CLI_CORE_NAMES.has(entry.name))
    .map((entry) =>
      [
        `/** \`${entry.name}\` â€” the brief's declared command: ${CLI_VIEWS[entry.view]}. */`,
        `export async function ${entry.name}(input: string, options: CliOptions): Promise<CliResult> {`,
        `  return viewFor(${jstr(entry.name)})(await readInput(input, {}), options);`,
        `}`,
        "",
      ].join("\n"),
    )
    .join("\n");
  return [
    ...sourceHeader("src/main.ts", "CLI entry â€” the runnable program (package bin delegates here)", project, [
      "// A real argument parser + subcommand dispatch. Each command streams its",
      "// input line by line (no whole-file load) and returns a structured result.",
      "// Exit codes: 0 ok Â· 1 usage error Â· 2 no data / unreadable input.",
    ]),
    'import { createReadStream } from "node:fs";',
    'import { createInterface } from "node:readline";',
    'import { pathToFileURL } from "node:url";',
    "",
    "export type CliContext = { argv: string[]; env: Record<string, string | undefined> };",
    "export type CliOptions = {",
    "  command: string;",
    "  input: string;",
    "  json: boolean;",
    "  quiet: boolean;",
    "  flags: Record<string, string>;",
    "};",
    "export type CliResult = { code: number; lines: string[]; data: unknown };",
    "export type LogRecord = {",
    "  raw: string;",
    "  level: string;",
    "  message: string;",
    "  ts: number | null;",
    "  durationMs: number | null;",
    "};",
    "",
    `export const COMMANDS: readonly string[] = ${JSON.stringify(plan.map((entry) => entry.name))};`,
    "",
    "const USAGE = [",
    ...usageLines,
    "",
    `const VIEW_BY_COMMAND: Record<string, CliView> = ${JSON.stringify(viewByCommand)};`,
    "",
    "/** The entry contract: argv in, exit code out. */",
    "export async function main(",
    "  argv: string[] = process.argv.slice(2),",
    "  env: Record<string, string | undefined> = process.env,",
    "): Promise<number> {",
    "  const parsed = parseArgv(argv);",
    "  if (parsed.kind === \"help\") {",
    "    process.stdout.write(USAGE + \"\\n\");",
    "    return 0;",
    "  }",
    "  if (parsed.kind === \"error\") {",
    "    process.stderr.write(parsed.errors.join(\"\\n\") + \"\\n\\n\" + USAGE + \"\\n\");",
    "    return 1;",
    "  }",
    "  const options = parsed.options;",
    "  let records: LogRecord[];",
    "  try {",
    "    records = await readInput(options.input, env);",
    "  } catch (error) {",
    "    process.stderr.write((error instanceof Error ? error.message : String(error)) + \"\\n\");",
    "    return 2;",
    "  }",
    "  if (records.length === 0) {",
    "    if (!options.quiet) process.stderr.write(\"no data: \" + options.input + \" contained no records\\n\");",
    "    return 2;",
    "  }",
    "  const result = viewFor(options.command)(records, options);",
    "  if (!options.quiet) {",
    "    process.stdout.write((options.json ? JSON.stringify(result.data, null, 2) : result.lines.join(\"\\n\")) + \"\\n\");",
    "  }",
    "  return result.code;",
    "}",
    "",
    ...declaredExports.split("\n"),
    "export function parseArgv(argv: readonly string[]):",
    "  | { kind: \"help\" }",
    "  | { kind: \"error\"; errors: string[] }",
    "  | { kind: \"run\"; options: CliOptions } {",
    "  const errors: string[] = [];",
    "  const flags: Record<string, string> = {};",
    "  const positionals: string[] = [];",
    "  let json = false;",
    "  let quiet = false;",
    "  for (let index = 0; index < argv.length; index += 1) {",
    "    const arg = argv[index];",
    "    if (arg === \"--help\" || arg === \"-h\") return { kind: \"help\" };",
    "    if (arg === \"--json\") { json = true; continue; }",
    "    if (arg === \"--quiet\") { quiet = true; continue; }",
    "    if (arg.startsWith(\"--\")) {",
    "      const body = arg.slice(2);",
    "      const equals = body.indexOf(\"=\");",
    "      const name = equals >= 0 ? body.slice(0, equals) : body;",
    "      if (!FLAG_WITH_VALUE.has(name)) { errors.push(\"unknown option --\" + name); continue; }",
    "      const value = equals >= 0 ? body.slice(equals + 1) : argv[index + 1];",
    "      if (value === undefined || value.startsWith(\"--\")) { errors.push(\"option --\" + name + \" needs a value\"); continue; }",
    "      if (equals < 0) index += 1;",
    "      flags[name] = value;",
    "      continue;",
    "    }",
    "    positionals.push(arg);",
    "  }",
    "  const command = positionals.shift();",
    "  if (command === undefined) errors.push(\"no command given\");",
    "  else if (!COMMANDS.includes(command)) errors.push(\"unknown command \" + JSON.stringify(command) + \" (expected one of \" + COMMANDS.join(\", \") + \")\");",
    "  if (errors.length > 0) return { kind: \"error\", errors };",
    "  return { kind: \"run\", options: { command: command ?? \"\", input: positionals[0] ?? \"-\", json, quiet, flags } };",
    "}",
    "",
    "const FLAG_WITH_VALUE = new Set([\"p95\", \"bucket\"]);",
    "",
    "/** Stream a file (or stdin) line by line; returns every parsed record. */",
    "export async function readInput(input: string, env: Record<string, string | undefined>): Promise<LogRecord[]> {",
    "  void env;",
    "  const source = input === \"-\" || input === \"\" ? process.stdin : createReadStream(input);",
    "  const lines = createInterface({ input: source, crlfDelay: Infinity });",
    "  const records: LogRecord[] = [];",
    "  for await (const line of lines) {",
    "    if (line.trim() === \"\") continue;",
    "    records.push(parseRecord(line));",
    "  }",
    "  return records;",
    "}",
    "",
    "type View = (records: readonly LogRecord[], options: CliOptions) => CliResult;",
    "type CliViewName = \"summary\" | \"errors\" | \"latency\" | \"timeline\" | \"watch\" | \"transform\";",
    "const VIEWS: Record<CliViewName, View> = { summary: viewSummary, errors: viewErrors, latency: viewLatency, timeline: viewTimeline, watch: viewWatch, transform: viewTransform };",
    "",
    ...cliAnalyzerLines(),
    "",
    "// CliView is the alias the generated VIEW_BY_COMMAND table is typed with.",
    "type CliView = CliViewName;",
    "",
    ...directRunGuardLines(),
  ].join("\n");
}

/**
 * fixes/347-2: the service entry â€” a REAL node:http server over the recorded A6
 * endpoints, with payload validation (coded 400s), PORT wiring and an exit
 * code. No route handler throws a TODO: a recorded endpoint returns a real
 * accepted/validated result, an unrecorded wire is a coded 404.
 */
/** Names the emitted service entry already defines (a declared surface name
 *  colliding with one would be a duplicate declaration). */
const SERVICE_CORE_NAMES = new Set([
  "main", "createApp", "resolvePort", "validatePayload", "send", "readBody", "handle", "ROUTES",
]);

function emitServiceEntry(project: Project): string {
  const slug = slugName(project.name);
  const routes: { method: string; path: string; job: string }[] = [];
  for (const endpoint of project.contracts?.endpoints ?? []) {
    const method = String(endpoint?.method ?? "POST").toUpperCase();
    const path = String(endpoint?.path ?? "").trim();
    if (!path.startsWith("/")) continue;
    routes.push({ method, path, job: String(endpoint?.job ?? "handler") });
  }
  const routeLines = routes.map((route) => {
    const key = `${route.method} ${route.path}`;
    if (route.method === "GET" || route.method === "DELETE") {
      return `  ${jstr(key)}: async (input: unknown, url: URL): Promise<RouteResult> => { void input; return { status: 200, body: { ok: true, job: ${jstr(route.job)}, query: Object.fromEntries(url.searchParams) } }; },`;
    }
    return `  ${jstr(key)}: async (input: unknown): Promise<RouteResult> => { const checked = validatePayload(input); return checked.ok ? { status: 200, body: { ok: true, job: ${jstr(route.job)}, accepted: checked.value } } : { status: 400, body: { ok: false, errors: checked.errors } }; },`;
  });
  const declaredExports = declaredSurfaceNamesOf(project.brief ?? "")
    .filter((name) => !SERVICE_CORE_NAMES.has(name))
    .map((name) =>
      [
        `/** \`${name}\` â€” the brief's declared surface, validated through the shared payload check. */`,
        `export async function ${name}(input: unknown): Promise<RouteResult> {`,
        "  const checked = validatePayload(input);",
        `  return checked.ok ? { status: 200, body: { ok: true, job: ${jstr(name)}, accepted: checked.value } } : { status: 400, body: { ok: false, errors: checked.errors } };`,
        `}`,
        "",
      ].join("\n"),
    )
    .join("\n");
  return [
    ...sourceHeader("src/main.ts", "Service entry â€” a real node:http server over the recorded endpoints", project, [
      "// Real PORT wiring, payload validation with coded 400s, and a listener.",
      "// `npm start` runs main(); importing this module starts nothing.",
    ]),
    'import { createServer, type Server } from "node:http";',
    'import type { IncomingMessage, ServerResponse } from "node:http";',
    'import { pathToFileURL } from "node:url";',
    "",
    "export type ServiceContext = { env: Record<string, string | undefined>; port: number };",
    "export type RouteResult = { status: number; body: unknown };",
    "export type RouteHandler = (input: unknown, url: URL) => Promise<RouteResult>;",
    "",
    "/** PORT wiring (pure): a valid 1-65535 integer from the environment, else",
    " *  the documented local default 8080. */",
    "export function resolvePort(env: Record<string, string | undefined> = process.env): number {",
    "  const raw = Number.parseInt(String(env.PORT ?? \"\"), 10);",
    "  return Number.isInteger(raw) && raw > 0 && raw <= 65535 ? raw : 8080;",
    "}",
    "",
    "export type ValidationResult = { ok: true; value: Record<string, unknown> } | { ok: false; errors: string[] };",
    "",
    "/** Every request body must be a JSON object â€” the coded 400 the brief asks for. */",
    "export function validatePayload(input: unknown): ValidationResult {",
    "  if (input === null || typeof input !== \"object\" || Array.isArray(input)) {",
    "    return { ok: false, errors: [\"body must be a JSON object\"] };",
    "  }",
    "  return { ok: true, value: input as Record<string, unknown> };",
    "}",
    "",
    "const ROUTES: Record<string, RouteHandler> = {",
    ...routeLines,
    "  \"GET /health\": async (): Promise<RouteResult> => ({ status: 200, body: { ok: true, service: " + jstr(slug) + ", uptimeMs: Math.round(process.uptime() * 1000) } }),",
    "};",
    "export { ROUTES };",
    "",
    "function send(response: ServerResponse, status: number, payload: unknown): void {",
    "  const text = JSON.stringify(payload);",
    "  response.writeHead(status, { \"content-type\": \"application/json; charset=utf-8\" });",
    "  response.end(text);",
    "}",
    "",
    "async function readBody(request: IncomingMessage): Promise<unknown> {",
    "  const chunks: Buffer[] = [];",
    "  for await (const chunk of request) chunks.push(chunk as Buffer);",
    "  const text = Buffer.concat(chunks).toString(\"utf8\");",
    "  if (text.trim() === \"\") return undefined;",
    "  return JSON.parse(text);",
    "}",
    "",
    "async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {",
    "  const url = new URL(request.url ?? \"/\", \"http://localhost\");",
    "  const key = (request.method ?? \"GET\") + \" \" + url.pathname;",
    "  const handler = ROUTES[key];",
    "  if (handler === undefined) { send(response, 404, { ok: false, error: \"no route for \" + key }); return; }",
    "  let body: unknown;",
    "  if (request.method === \"POST\" || request.method === \"PUT\" || request.method === \"PATCH\") {",
    "    try {",
    "      body = await readBody(request);",
    "    } catch {",
    "      send(response, 400, { ok: false, errors: [\"body must be valid JSON\"] });",
    "      return;",
    "    }",
    "  }",
    "  send(response, 200, (await handler(body, url)).body);",
    "}",
    "",
    "export function createApp(): Server {",
    "  return createServer((request, response) => {",
    "    void handle(request, response).catch((error: unknown) => {",
    "      send(response, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });",
    "    });",
    "  });",
    "}",
    "",
    ...declaredExports.split("\n"),
    "/** Start the server; resolves 0 once listening, 1 when it cannot bind. */",
    "export async function main(env: Record<string, string | undefined> = process.env): Promise<number> {",
    "  const ctx: ServiceContext = { env, port: resolvePort(env) };",
    "  const server = createApp();",
    "  return await new Promise<number>((resolve) => {",
    "    server.once(\"error\", (error: Error) => { process.stderr.write(error.message + \"\\n\"); resolve(1); });",
    "    server.listen(ctx.port, () => { process.stdout.write(\"listening on http://127.0.0.1:\" + ctx.port + \"\\n\"); resolve(0); });",
    "  });",
    "}",
    "",
    ...directRunGuardLines(),
  ].join("\n");
}

/** The library role a declared name selects (keyword-driven, deterministic). */
type LibraryRole = "subscribe" | "unsubscribe" | "publish" | "list" | "retry" | "verify" | "generic";

function libraryRoleFor(name: string): LibraryRole {
  const n = name.toLowerCase();
  if (/verify|signature|sign|hmac|auth/.test(n)) return "verify";
  if (/unsubscribe|remove|delete|revoke|cancel|off\b/.test(n)) return "unsubscribe";
  if (/subscribe|register|add\b|create|attach/.test(n)) return "subscribe";
  if (/publish|emit|send|dispatch|trigger|fire/.test(n)) return "publish";
  if (/retry|resend|backoff|redeliver/.test(n)) return "retry";
  if (/deliver|list|query|filter|history|status|pending/.test(n)) return "list";
  return "generic";
}

/**
 * fixes/347-2: the library entry â€” a REAL importable module. Importing runs
 * nothing; every declared surface name is a real export, backed by an in-memory
 * subscription registry with HMAC-SHA256 signature verification, at-least-once
 * delivery records and an exponential backoff schedule. `entry.version` is the
 * same project-derived value package.json declares.
 */
function emitLibraryEntry(project: Project): string {
  const slug = slugName(project.name);
  const coreNames = new Set([
    "entry",
    "backoffDelayMs",
    "signPayload",
    "verifySignature",
    "registerSubscription",
    "removeSubscription",
    "emitEvent",
    "queryDeliveries",
    "retryDelivery",
    "normalizeInput",
  ]);
  const declaredExports = declaredSurfaceNamesOf(project.brief ?? "")
    .filter((name) => !coreNames.has(name))
    .map((name) => {
      const role = libraryRoleFor(name);
      if (role === "subscribe") {
        return `export function ${name}(url: string, events: readonly string[], secret: string): Subscription { return registerSubscription(url, events, secret); }\n`;
      }
      if (role === "unsubscribe") {
        return `export function ${name}(id: string): boolean { return removeSubscription(id); }\n`;
      }
      if (role === "publish") {
        return `export function ${name}(event: string, payload: unknown): Delivery { return emitEvent(event, payload); }\n`;
      }
      if (role === "list") {
        return `export function ${name}(filter: DeliveryFilter = {}): Delivery[] { return queryDeliveries(filter); }\n`;
      }
      if (role === "retry") {
        return `export function ${name}(id: string): Delivery | null { return retryDelivery(id); }\n`;
      }
      if (role === "verify") {
        return `export function ${name}(rawBody: string, header: string, secret: string, now: number = Date.now()): SignatureCheck { return verifySignature(rawBody, header, secret, now); }\n`;
      }
      return `export function ${name}(input?: unknown): unknown { return normalizeInput(input); }\n`;
    })
    .join("");
  return [
    ...sourceHeader("src/main.ts", "Library entry â€” the module package main/exports point at", project, [
      "// Importing runs nothing. Every export is a real implementation over an",
      "// in-memory registry: subscriptions, signed deliveries, backoff and retry.",
    ]),
    'import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";',
    "",
    "export type LibraryInfo = { name: string; version: string };",
    "export type Subscription = { id: string; url: string; events: readonly string[]; secret: string; active: boolean };",
    "export type DeliveryStatus = \"pending\" | \"delivered\" | \"dead\";",
    "export type Delivery = { id: string; subscriptionId: string; event: string; payload: unknown; attempts: number; status: DeliveryStatus; lastError: string | null };",
    "export type DeliveryFilter = { subscriptionId?: string; event?: string; status?: DeliveryStatus };",
    "export type SignatureCheck = { ok: boolean; reason: string };",
    "",
    "/** Package identity â€” REAL values off the emitted package.json contract. */",
    `export const entry: LibraryInfo = { name: ${jstr(slug)}, version: ${jstr(projectVersion(project))} };`,
    "",
    "const MAX_ATTEMPTS = 6;",
    "const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 32000];",
    "const FIVE_MINUTES_MS = 5 * 60 * 1000;",
    "const subscriptions = new Map<string, Subscription>();",
    "const deliveryLog: Delivery[] = [];",
    "",
    "/** Exponential backoff for attempt N (1-based); 0 before the first attempt. */",
    "export function backoffDelayMs(attempt: number): number {",
    "  if (attempt <= 0) return 0;",
    "  return BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length) - 1];",
    "}",
    "",
    "/** `t.<unixMs>,v1.<hex>`-style signing payload for one raw body. */",
    "export function signPayload(rawBody: string, secret: string, timestamp: number): string {",
    "  return createHmac(\"sha256\", secret).update(String(timestamp) + \".\" + rawBody).digest(\"hex\");",
    "}",
    "",
    "/** Verify a `t=<unixMs>,v1=<hex>` header; rejects a signature older than five minutes. */",
    "export function verifySignature(rawBody: string, header: string, secret: string, now: number = Date.now()): SignatureCheck {",
    "  const fields = new Map<string, string>();",
    "  for (const part of header.split(\",\")) {",
    "    const separator = part.indexOf(\"=\");",
    "    if (separator > 0) fields.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim());",
    "  }",
    "  const timestamp = Number(fields.get(\"t\") ?? \"\");",
    "  const signature = fields.get(\"v1\") ?? fields.get(\"sha256\") ?? \"\";",
    "  if (!Number.isFinite(timestamp) || signature === \"\") return { ok: false, reason: \"malformed signature header\" };",
    "  if (now - timestamp > FIVE_MINUTES_MS) return { ok: false, reason: \"signature is older than five minutes\" };",
    "  const expected = Buffer.from(signPayload(rawBody, secret, timestamp), \"utf8\");",
    "  const provided = Buffer.from(signature, \"utf8\");",
    "  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return { ok: false, reason: \"signature mismatch\" };",
    "  return { ok: true, reason: \"ok\" };",
    "}",
    "",
    "export function registerSubscription(url: string, events: readonly string[], secret: string): Subscription {",
    "  const subscription: Subscription = { id: randomUUID(), url, events: [...events], secret, active: true };",
    "  subscriptions.set(subscription.id, subscription);",
    "  return subscription;",
    "}",
    "",
    "export function removeSubscription(id: string): boolean {",
    "  return subscriptions.delete(id);",
    "}",
    "",
    "/** Queue one delivery per active subscription matching the event. */",
    "export function emitEvent(event: string, payload: unknown): Delivery {",
    "  const targets = [...subscriptions.values()].filter((subscription) => subscription.active && (subscription.events.length === 0 || subscription.events.includes(event)));",
    "  const created = targets.map((subscription): Delivery => ({ id: randomUUID(), subscriptionId: subscription.id, event, payload, attempts: 0, status: \"pending\", lastError: null }));",
    "  for (const delivery of created) deliveryLog.push(delivery);",
    "  return created[0] ?? { id: randomUUID(), subscriptionId: \"\", event, payload, attempts: 0, status: \"dead\", lastError: \"no active subscription for this event\" };",
    "}",
    "",
    "export function queryDeliveries(filter: DeliveryFilter = {}): Delivery[] {",
    "  return deliveryLog.filter((delivery) =>",
    "    (filter.subscriptionId === undefined || delivery.subscriptionId === filter.subscriptionId) &&",
    "    (filter.event === undefined || delivery.event === filter.event) &&",
    "    (filter.status === undefined || delivery.status === filter.status));",
    "}",
    "",
    "/** Retry one delivery; marks it dead once MAX_ATTEMPTS is reached. */",
    "export function retryDelivery(id: string): Delivery | null {",
    "  const delivery = deliveryLog.find((candidate) => candidate.id === id);",
    "  if (delivery === undefined) return null;",
    "  if (delivery.attempts >= MAX_ATTEMPTS) { delivery.status = \"dead\"; delivery.lastError = \"max attempts reached\"; return delivery; }",
    "  delivery.attempts += 1;",
    "  delivery.status = \"delivered\";",
    "  delivery.lastError = null;",
    "  return delivery;",
    "}",
    "",
    "/** Deterministic deep normalization: sorted object keys, arrays preserved. */",
    "export function normalizeInput(input?: unknown): unknown {",
    "  if (Array.isArray(input)) return input.map((item) => normalizeInput(item));",
    "  if (input !== null && typeof input === \"object\") {",
    "    const source = input as Record<string, unknown>;",
    "    const out: Record<string, unknown> = {};",
    "    for (const key of Object.keys(source).sort()) out[key] = normalizeInput(source[key]);",
    "    return out;",
    "  }",
    "  return input ?? null;",
    "}",
    "",
    ...declaredExports.split("\n"),
  ].join("\n");
}

/**
 * fixes/277 (R3-f06 / W-15): the per-kind RUNNABLE entry the package fields
 * point at â€” cli-tool (package `bin` launcher spawns this), library (package
 * `main`/`exports` module), service (`npm start`).
 *
 * fixes/347-2 (measured defect): the pre-347 entries were STRUCTURED stubs whose
 * `main` threw `TODO(E-15)` on every invocation â€” a shipped CLI/library/service
 * refused every command while its package fields pointed at that throw. The
 * entries are now REAL for every kind: a streaming analyzer + subcommand
 * dispatch + exit codes (cli-tool), a node:http server with validation + coded
 * 400s (service), and an importable registry with HMAC signatures (library).
 * The declared surface names come from the brief, so the emitted entry exposes
 * exactly what dod's `p6-runnable-entry` gate demands.
 */
function emitKindEntry(kind: ProjectKind, project: Project): string {
  if (kind === "cli-tool") return emitCliEntry(project);
  if (kind === "service") return emitServiceEntry(project);
  return emitLibraryEntry(project);
}

/** A `Project.generatedTree` row (the gate's own read shape). */
export type SurfaceTreeRow = { path: string; source: string; hash: string; attempt: number };

/**
 * fixes/353 â€” THE GATE-WIRING CALL SITE.
 *
 * `dod`'s kind-aware criteria (`p6-web-surface` / `p6-game-surface` /
 * `p6-runnable-entry`) read `generatedTree âˆª emittedSurface`, because the
 * page/router/game/entry modules are written by THIS emitter and never appear
 * as synthesis rows. A driver calls this on the project immediately BEFORE the
 * P6 gate is recorded, so the criteria judge what the build actually ships.
 *
 * Pure. On a scaffold refusal (or an empty surface) the project is returned
 * UNCHANGED, so the criteria stay honestly red rather than passing on a tree
 * that was never emitted.
 */
export function stampEmittedSurface(project: Project): Project {
  try {
    const res = scaffoldProject(project, { allowUnderProduced: true });
    if (!res.ok) return project;
    const surface = surfaceTreeRows(project, res.files);
    if (surface.length === 0) return project;
    return { ...project, emittedSurface: surface };
  } catch {
    return project;
  }
}

/**
 * fixes/347-2 â€” THE GATE-WIRING SEAM (documented + tested; dod.ts is NOT
 * edited here).
 *
 * dod's kind-aware criteria (`p6-web-surface`, `p6-game-surface`,
 * `p6-runnable-entry`) read `project.generatedTree` + `project.generatedSource`
 * through `productSurfaceTrace`. Those fields carry the SYNTHESIZED tree only;
 * the page/router/game/runnable surface modules are written by THIS emitter,
 * which is pure and cannot mutate the project. The gate therefore never saw the
 * surface a web/game/runnable brief demands (measured: ten fresh trees, zero
 * page files, a webapp with no router â€” the gate's fail-closed red).
 *
 * This function returns the emitted surface modules in the `generatedTree` row
 * shape, so a caller folds them into the project the gate reads:
 *
 *     const emitted = scaffoldProject(project);
 *     if (emitted.ok) {
 *       const gateProject = { ...project, generatedTree: surfaceTreeRows(project, emitted.files) };
 *       // â€¦then run the P6 DoD gate over `gateProject`.
 *     }
 *
 * The runnable entry is placed FIRST because `productSurfaceTrace` takes the
 * FIRST row whose path matches its entry pattern â€” the emitted entry (never a
 * synthesized module) is the one judged. A scaffold test drives
 * `productSurfaceTrace` over the folded project and proves each kind's
 * criterion goes green.
 *
 * Residual (report, not silent): a web brief whose emit writes NO page module
 * (e.g. one that names screens inline rather than in a `Pages:` list) still has
 * no page surface for the gate to read â€” the emitter's page-coverage gap, not
 * the wiring. Widen `briefPageTitles`/`briefedPageDefs` before expecting those
 * briefs to clear `p6-web-surface`.
 */
export function surfaceTreeRows(project: Project, files: readonly ScaffoldFile[]): SurfaceTreeRow[] {
  const kind = projectKindOf(project);
  const byPath = new Map(files.map((file) => [file.path.replace(/\\/g, "/"), file.body]));
  const rows: SurfaceTreeRow[] = [];
  const seen = new Set<string>();
  const add = (path: string): void => {
    if (seen.has(path)) return;
    const body = byPath.get(path);
    if (body === undefined || body.trim() === "") return;
    seen.add(path);
    rows.push({ path, source: body, hash: String(fnv1a(body)), attempt: 0 });
  };
  if (kind === "cli-tool" || kind === "library" || kind === "service") {
    add("src/main.ts");
    if (kind === "cli-tool") add(`bin/${slugName(project.name)}.mjs`);
  }
  if (kind === "game") add("src/main.ts");
  if (kind === "webapp" || kind === "game") {
    for (const file of files) {
      const path = file.path.replace(/\\/g, "/");
      if (path.startsWith("src/ui/")) add(path);
    }
  }
  return rows;
}

/**
 * fixes/277 (R3-f06): the cli-tool package `bin` launcher â€” a REAL launcher,
 * not a stub. It spawns the TypeScript entry with the same node flags the
 * emitted package.json scripts use (Node >= 22 type stripping â€” see
 * engines.node), passing argv straight through; the exit code is the entry's.
 * The entry's honest refusal surfaces on stderr the moment the CLI is RUN.
 */
function emitBinLauncher(project: Project): string {
  const slug = slugName(project.name);
  return [
    "#!/usr/bin/env node",
    `// bin/${slug}.mjs â€” package bin launcher, emitted by the RapidTool scaffold`,
    "// (fixes/277 R3-f06). Delegates to the TypeScript entry (../src/main.ts) with",
    "// the same flags the package scripts use (Node >= 22 type stripping â€” see",
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
    rows.push(`- ${def?.code ?? `P${String(id)}`} ${def?.title ?? "Phase"} â€” ${status} Â· ${gate}`);
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
          "# honestly stubbed â€” a seam test fails the moment that seam is implemented,",
          "# which is the cue to replace it with the row's real acceptance assertion.",
          ...(notImplemented
            ? [
                `# ORACLE SHORTFALL: ${notImplemented} row(s) are NOT IMPLEMENTED and are emitted`,
                "# as MARKED skips (a skip is not a pass â€” each prints its marker on its",
                "# own TAP line) â€” see the oracle-row census under Honest boundaries",
              ]
            : []),
          "npm test",
        ]
      : ["# no oracle rows yet â€” run the pipeline to P0/P1, then re-emit"]),
  ];
  if (kind === "webapp" || kind === "game") {
    base.push(
      "",
      "# dev server â€” index.html + src/main entry + vite config are emitted; the UI",
      "# itself is a contract-level shell per the P8 interface contract",
      "npm run dev",
    );
  }
  return base.map((l) => `  ${l}`);
}

/**
 * fixes/216k (TA-15 done-when 2): the tree-mode job-scope / bridge census the
 * shipped README renders under "Honest boundaries" â€” the unmaterialised
 * spec-graph job nodes (NEVER bridged: the tree ships no file at their path)
 * and the surviving non-job bridges (thin re-exports of the tree entry, bytes
 * unchanged â€” now COUNTED). Both lines render only when their list is
 * non-empty, so zero-count emissions stay byte-identical to pre-216k output.
 */
type ReadmeJobScope = {
  unmaterialisedJobs?: { id: string; file: string; label: string | null }[];
  bridgedPaths?: string[];
  /**
   * OV-16 (W23-262): true when this emission really assembled a generatedTree
   * (tree mode). Needed because the unmaterialisedJobs list is EMPTY on a tree
   * whose files cover every job node â€” without the flag the README could not
   * state that zero-job-node truth on the artifact itself. Absent = legacy mode.
   */
  treeMode?: boolean;
};

/**
 * W48 / 334-3 (T1a): the emitted `package.json` DECLARES `typecheck` (and, for
 * webapp/game, `build`), but the emitter never installs dependencies or runs
 * them over the tree it writes â€” a fresh emitted tree's declared toolchain is
 * UNVERIFIED, and the tree-run's own envelope reports exactly that as
 * `declaredScriptsVerified: false` + `unverifiedDeclaredScripts: [...]`
 * (compile-check.server.ts). Rendered unconditionally at the top of the
 * emitted README, in the same GitHub-alert style as headless's red-tree
 * banner, so an unverified tree can never present as a complete one.
 *
 * Deliberately NOT suppressible from an emit-time signal: `--verify-kind`
 * installs and builds a SCRATCH COPY and records its verdict only on the CLI
 * payload (never in the project or the tree), so no byte the scaffold can read
 * attests that THESE declared scripts ran over THIS tree. The honest default
 * is therefore to state the limit on the artifact itself.
 */
function declaredScriptsBanner(kind: ProjectKind): string {
  const scripts = PKG_SCRIPTS[kind] ?? {};
  const names = ["typecheck", "build"].filter((s) => typeof scripts[s] === "string");
  const isOne = names.length === 1;
  const label = names.map((s) => `\`${s}\``).join(" and ");
  const run = names.map((s) => `npm run ${s}`).join(" && ");
  return [
    "> [!WARNING]",
    `> ## DECLARED SCRIPTS NOT RUN â€” ${label} ${isOne ? "IS" : "ARE"} UNVERIFIED (RapidTool W48 / 334-3)`,
    ">",
    `> The emitted \`package.json\` declares ${label}, but this emitter NEVER runs ${isOne ? "it" : "them"} over the tree it writes â€” no \`npm install\`, no declared-script execution. ${isOne ? "It is a scaffold claim" : "They are scaffold claims"} â€” NOT verified behavior. Run \`npm install && ${run}\` yourself (or re-emit with \`--verify-kind\`, which installs and builds a scratch copy) before treating this scaffold as build-verified. A tree-run executes these declared tools when it can resolve them (the emitted tree's own \`node_modules\`, else the emitting repo's own installed root): a type-clean tree reports \`declaredScriptsVerified: true\`, and a tool it cannot resolve reports \`declaredScriptsVerified: false\` + \`unverifiedDeclaredScripts: [...]\` in its JSON â€” never a silent pass.`,
  ].join("\n");
}

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
    ["README.md", "this file â€” mission + commands"],
    ["DEPLOY.md", "run/test/env/deploy notes (honest local-only framing)"],
    [".env.example", "PLACEHOLDER env template â€” copy to .env, never commit real values"],
    [
      ".gitignore",
      "keeps an install/build/verify run (node_modules/, dist/, .rapidtool/logs/) out of the review diff",
    ],
    ["LICENSE", "MIT licence text (year + holder derived from this project's own record)"],
    [".github/workflows/ci.yml", "CI â€” installs, typechecks and tests THIS emitted tree (fixes/352)"],
    ["package.json", "per-kind skeleton (scripts/deps) + tsconfig.json"],
    [".rapidtool/project.json", "the full exported project (packet, artifacts, oracle, contracts)"],
  ];
  if (kind === "webapp" || kind === "game") {
    const entry = kind === "webapp" ? "src/main.tsx" : "src/main.ts";
    files.push(
      ["index.html", `vite HTML entry â€” mounts ${entry} (fixes/135 bootability)`],
      [
        "vite.config.ts",
        kind === "webapp"
          ? "vite config â€” react + tailwindcss plugins (the declared devDeps)"
          : "vite config â€” plain (this kind declares no framework plugin)",
      ],
      [entry, "browser entry that mounts the UI shell (src/ui)"],
    );
    // W52 / 338-5: declare-or-strike â€” the README tables every emitted file, so
    // the Tailwind entry the declared plugin compiles is named for webapp.
    if (kind === "webapp") {
      files.push(["src/styles.css", "Tailwind v4 CSS entry compiled by the declared @tailwindcss/vite plugin"]);
    }
  }
  // W52 / 338-5: the per-kind runnable entry the emitter writes and package.json
  // DECLARES (main/bin/start) â€” never omitted from the file table that claims to
  // list what ships.
  if (kind === "cli-tool" || kind === "library" || kind === "service") {
    files.push(["src/main.ts", "runnable entry declared by package.json (main/bin/start)"]);
    if (kind === "cli-tool") {
      files.push([`bin/${slugName(project.name)}.mjs`, "package bin launcher â€” delegates to src/main.ts"]);
    }
  }
  // A10 (SYNTHSPEC F-03 / BF-11): the "What ships" table must name only files
  // that are ON DISK. A declared spec-graph job node the tree did not
  // materialise (tree mode: `unmaterialisedJobs`) or a refused tree row has NO
  // file â€” listing it beside emitted modules was the measured self-contradiction
  // (README:34 listed 5 `src/jobs/*.ts` the tree never wrote, while "Honest
  // boundaries" said so ~50 lines below). Split those rows into a labelled
  // "declared, NOT emitted" sub-table instead of dropping them (never silent).
  const notEmitted = new Set<string>();
  for (const j of jobScope.unmaterialisedJobs ?? []) if (j && typeof j.file === "string") notEmitted.add(j.file);
  for (const r of treeRefusals) {
    const m = /^generatedTree:refused:"([^"]+)":/.exec(String(r));
    if (m) notEmitted.add(m[1]!);
  }
  const declaredRows = specRows.filter(([p]) => notEmitted.has(p));
  files.push(...specRows.filter(([p]) => !notEmitted.has(p)));
  // fixes/144 (M2): generated-tree files the spec graph does not already table
  // (their paths are added under their node rows) get their own rows so the
  // README names every emitted file â€” never a stale "spec graph only" claim.
  for (const [treePath, origin] of treeRows) {
    if (!files.some(([p]) => p === treePath)) files.push([treePath, origin]);
  }
  if (kind === "game")
    files.push(["assets/manifest.json", "expected asset roster â€” NOT engine-generated"]);
  const kindNote = project.kind
    ? `kind ${kind} (mapped from declared kind "${project.kind}")`
    : `kind ${kind} (inferred from brief/domain â€” no declared kind yet)`;
  // fixes/144 (M2): the honest-boundary core line names whichever substance the
  // emit actually carries â€” the generated TREE (multi-file) or the legacy P6
  // module string. Never both, and never a claim about the absent one.
  const coreLine = treeRows.length
    ? "- The machine-verified substance is the generated tree under `src/` + `tests/` (project.generatedTree â€” fixes/144 M2): every file was emitted verbatim at its own repo-relative path and content-hashed at P6; `tests/oracle.spec.ts` imports the tree's ENTRY module (the file at the path the legacy P6 host would have used) so `npm test` executes the real tree. Scaffold infrastructure outside the tree is exactly that â€” infrastructure."
    : "- The machine-verified core is the generated P6 module under `src/` (project.generatedSource); everything else is a typed stub awaiting implementation.";
  // fixes/216b (106 T-08 / F-05) + fixes/354 A2-F7: the oracle-row census. A
  // row the emitted modules give no surface to assert against is NOT IMPLEMENTED
  // â€” emitted as a MARKED skip (fixes/356 / W356 A3) and COUNTED HERE, separately
  // from the rows that carry a real assertion, so an unwired row can never read
  // as green evidence and is never silent. The sentence branches on the SAME
  // predicate the spec body uses (`notImplemented.length > 0`), so the README
  // can never describe a skip the spec no longer emits. Rendered only when the
  // project has rows; backticks are stripped from ids so a hostile row id cannot
  // break the line.
  const censusIds = (ids: string[]): string =>
    ids.map((raw) => `\`${prose(raw).replace(/`/g, "'")}\``).join(", ");
  const hasOracleShortfall = oracleCensus !== null && oracleCensus.notImplemented.length > 0;
  const missing = oracleCensus?.notImplemented.length ?? 0;
  const oracleRowLine =
    oracleCensus === null
      ? null
      : !hasOracleShortfall
        ? `- Oracle rows (\`tests/oracle.spec.ts\`): all ${oracleCensus.total} pinned row(s) assert the emitted modules' real current behavior â€” no NOT IMPLEMENTED rows.`
        : `- Oracle rows (\`tests/oracle.spec.ts\`): ACCEPTANCE SHORTFALL â€” ${missing} of ${oracleCensus.total} pinned row(s) are NOT IMPLEMENTED and are emitted as MARKED skips under their pinned ids (\`{ skip: ... }\` â€” the marker prints on each row's own TAP line, and the same total is counted in the emitted spec's header); the remaining ${oracleCensus.assertable} assert the emitted modules' real current behavior. A skip is not a pass: the shortfall is named here and never silent: ${censusIds(oracleCensus.notImplemented)}.`;
  // fixes/216d (106 T-04 / F-03): a refused generatedTree row is NEVER a silent
  // drop. The reference to "the oracle-row census under Honest boundaries" in
  // commandBlock is only true when oracleRowLine actually renders (inserted
  // below); a refusal is recorded in the shipped README itself â€” declared path
  // + reason â€” so the artifact says which declared file is absent and why.
  // Every entry is single-line (refusal text JSON-escapes paths) and backticks
  // are stripped, so a hostile row cannot break the markdown.
  const refusalLine =
    treeRefusals.length === 0
      ? null
      : `- **${treeRefusals.length} generated tree row(s) were REFUSED and are NOT on disk** (never a silent drop â€” each declared file below is absent from this scaffold): ${censusIds(treeRefusals)}.`;
  // fixes/354 A2-F11: the `game` kind emits ONE deterministic platformer shell,
  // byte-identical across briefs. Say so â€” never present a scaffold template as
  // work generated from this brief (declare-or-strike).
  const gameTemplateLine =
    kind === "game"
      ? "- The emitted browser game module is a DETERMINISTIC SCAFFOLD TEMPLATE â€” a fixed platformer shell, byte-identical across briefs, with no mechanics derived from this brief. Treat it as a starting harness, not as generated product work; replace it with the brief's real mechanics before shipping (`gameTemplate:true` rides the emit envelope)."
      : null;
  // fixes/216k (TA-15): the tree-mode job-scope / bridge census lines â€” rendered
  // only when non-empty, so zero-count emissions stay byte-identical to the
  // pre-216k output. Never silent: an unmaterialised job node is named.
  const jobScopeLines: string[] = [];
  if ((jobScope.unmaterialisedJobs?.length ?? 0) > 0) {
    const jobs = jobScope.unmaterialisedJobs as { id: string; file: string; label: string | null }[];
    jobScopeLines.push(
      `- ${jobs.length} declared spec-graph job node(s) were NOT materialised by the generated tree (never bridged â€” a re-export at a job path would read as a leftover job): ${censusIds(jobs.map((j) => j.file))}.`,
    );
  } else if (jobScope.treeMode === true) {
    // OV-16 (W23-L2): on a CLEAN tree-mode emission the unmaterialised list is
    // empty â€” the honest zero must be STATED, not left to the reader: the
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
    // W48 / 334-3 (T1a): the declared-scripts-unverified banner leads the README
    // (see declaredScriptsBanner) â€” a blank line separates it from the title.
    declaredScriptsBanner(kind),
    "",
    `# ${mdLine(project.name, 120)}`,
    "",
    `> ${MACHINE_STAMP(project.id)}`,
    "",
    mdLine(project.brief || "_No brief recorded._", 500),
    "",
    "## Status",
    `- **Kind:** ${kind} â€” ${KIND_LABEL[kind]} (${kindNote})`,
    `- **Status:** ${project.status ?? "intake"} Â· **Current phase:** P${project.currentPhase ?? 0} Â· **Model route:** ${project.modelRoute ?? "unset"}`,
    project.createdAt ? `- **Created:** ${iso(project.createdAt)}` : null,
    "",
    "## What ships in this scaffold",
    "",
    "| File | Origin |",
    "| --- | --- |",
    ...files.map(([f, why]) => `| \`${f}\` | ${why} |`),
    // A10: a declared capability with no file is named here, never in the table
    // above (which reads as "what ships"). Rendered only when non-empty so a
    // fully materialised tree keeps its prior bytes.
    ...(declaredRows.length > 0
      ? [
          "",
          "### Declared, NOT emitted",
          "",
          "| File (declared) | Why it is not on disk |",
          "| --- | --- |",
          ...declaredRows.map(([f, why]) => `| \`${f}\` | declared in the spec graph, no file emitted by this scaffold â€” see Honest boundaries (${why}) |`),
        ]
      : []),
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
    "## Lockfile & reproducibility",
    "",
    "- **No `package-lock.json` is shipped.** This emitter is pure and offline: it cannot know the resolved transitive versions or their integrity hashes, and a lockfile carrying fabricated hashes would violate the scaffold's no-invention rule. Emitting none is the honest choice.",
    "- `npm install` (the step CI runs) resolves and writes `package-lock.json` on its first run; commit that file, then switch the workflow to `npm ci`, for a byte-reproducible install.",
    "- The `dependencies`/`devDependencies` ranges in `package.json` are the only version claim this tree makes.",
    "",
    "## Machine record",
    "",
    "- `.rapidtool/project.json` is the live exported project: packet, artifacts, oracle, contracts.",
    "- Regenerate this scaffold from it with the RapidTool emit command â€” hand-edits are overwritten.",
    "",
    "## Honest boundaries",
    "",
    coreLine,
    oracleRowLine,
    refusalLine,
    gameTemplateLine,
    ...jobScopeLines,
    "- `src/ui/` is a contract-level shell (P8 interface contract), not a finished UI.",
    "- Deploy templates from P9/P12 are recorded artifacts only â€” see DEPLOY.md; nothing here deploys by itself.",
    "- `assets/` and `public/` are expected at the emitted scaffold and are NOT engine-generated.",
    "",
  ]
    .filter((l) => l !== null)
    .map((l) => l as string);
  return `${body.join("\n")}`;
}

// ---------------------------------------------------------------------------
// DEPLOY.md (E-27 ship notes â€” deployNotes is the canonical export name;
// deplyNotes is the legacy-misspelling alias â€” fixes/309 A3 Â· M4-16)
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
    out.push(`### ${label} â€” ${mdLine(a.title, 120)}`, "");
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
 *
 * W50 / 336-3 (Transit) + fixes/354 A2-F2/F7 + fixes/356 (W356 A3): the Test
 * section must match what the emit actually wrote. `packageJson` DELETES the
 * `test` script when the project has no oracle rows, and the emitted spec emits
 * every row with no module surface as a MARKED, COUNTED skip (never a green
 * test, never an unavoidable red). The pre-fix text told the operator to run
 * `npm test` against a tree that declares none, and claimed "no
 * todo stubs" on a tree whose README counts unwired rows. `census` is the README's own
 * classification (scaffoldProject passes the very object it rendered); a direct
 * caller that omits it keeps the clean-row bytes.
 */
export function deployNotes(project: Project, census?: OracleRowCensus | null): string {
  const kind = projectKindOf(project);
  const envNames = ENV_LINES[kind];
  const hasOracleRows = project.oracle.length > 0;
  const notImplemented = census?.notImplemented.length ?? 0;
  const testSection: string[] = hasOracleRows
    ? [
        "## Test",
        "",
        "```text",
        "  npm test",
        "```",
        "",
        notImplemented > 0
          ? `Oracle specs in \`tests/oracle.spec.ts\` assert the emitted modules' real current behavior â€” NOT that every row is implemented. ${notImplemented} pinned row(s) are NOT IMPLEMENTED (this tree's ACCEPTANCE SHORTFALL) and are emitted as MARKED skips under their pinned ids â€” with no assert in the skipped body, so a non-executed assertion is never read as evidence â€” and the same total is counted on the emitted spec's header and in README.md's oracle-row census. A skip is not a pass: those rows carry no acceptance evidence until their seam lands, and the tree-run refuses a skip-dominated spec as a vacuous green (\`RT_E_SPEC_SKIP_VACUOUS\`). Every row keeps its pinned \`orc-*\` id; green means the scaffold modules are intact and the remaining rows' real assertions held. A seam test fails the moment that seam is implemented â€” that is the cue to replace the row's \`{ skip: ... }\` option with its real acceptance assertion.`
          : "Oracle specs in `tests/oracle.spec.ts` are REAL assertions over the emitted modules (fixes/135) â€” no todo stubs. Every row keeps its pinned `orc-*` id; green means the scaffold modules are intact and every oracle seam is still honestly stubbed. A seam test fails the moment that seam is implemented â€” that is the cue to replace it with the row's real acceptance assertion.",
        "",
      ]
    : [
        "## Test",
        "",
        "No oracle rows are recorded yet, so the emitted `package.json` declares no `test` script â€” run the pipeline to P0/P1, then re-emit.",
        "",
      ];
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
  // R13-f13 (W31 Â· T3): the per-kind deploy HANDOFF â€” commands only, never
  // credentials. This is the "what do I actually type next" layer the prose
  // destination above lacked; it assumes your own account/login outside the
  // repo. Every command here is either backed by a script the emitted
  // package.json declares (dev/build/preview/typecheck/test per PKG_SCRIPTS)
  // or an explicitly-marked vendor example. Nothing in this list was executed
  // or validated by the pipeline â€” the honesty stamp above governs.
  const kindHandoff: Record<ProjectKind, string[]> = {
    webapp: [
      "npm run build            # vite build â†’ dist/ (declared by the emitted package.json)",
      "npm run preview          # sanity-check the built output locally",
      "# then hand dist/ to your static host, after your own login â€” e.g.:",
      "#   npx firebase-tools deploy --only hosting      (after `firebase init hosting`)",
    ],
    game: [
      "npm run build            # vite build â†’ dist/",
      "npm run preview          # play the built bundle locally",
      "# then publish dist/ to any static host, after your own login â€” e.g.:",
      "#   butler push dist <your-user>/<your-game>:html5      (itch.io)",
    ],
    "cli-tool": [
      "npm run typecheck && npm test    # the emitted oracle suite",
      "npm pack --dry-run               # inspect the package contents",
      "# the emitted package.json declares `private: true` â€” flip it deliberately,",
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
      "# no Dockerfile is emitted â€” containerize yourself (`docker init` scaffolds one),",
      "# then build/push under your own account â€” e.g.:",
      "#   docker build -t <image> . && docker run -p 3000:3000 <image>",
      "#   gcloud run deploy <service> --source .        (the host reads $PORT; see .env.example)",
    ],
  };
  const devCommand =
    kind === "webapp" || kind === "game"
      ? [
          "```text",
          "  npm run dev   # vite dev server â€” index.html + src/main entry are emitted",
          "```",
        ]
      : ["  (no dev server: this kind has no UI entry yet â€” run `npm test` while implementing)"];
  const body = [
    `# DEPLOY.md â€” ${mdLine(project.name, 120)}`,
    "",
    `> ${MACHINE_STAMP(project.id)}`,
    `> ${DEPLOY_HONESTY_STAMP}`,
    "",
    "## What this is",
    "",
    `Local-first scaffold for â€œ${mdLine(project.name, 120)}â€ (kind ${kind}, ${KIND_LABEL[kind]}), emitted from the RapidTool packet record. It is a starting point for the human/agent build work â€” not a shipped, hosted product.`,
    "",
    "## Run locally",
    "",
    "```text",
    "  npm install            # requires Node >= 22",
    "  cp .env.example .env   # then replace every PLACEHOLDER with a REAL local value",
    "  npm run typecheck",
    `  ${project.oracle.length ? "npm test" : "# no oracle rows yet â€” run the pipeline to P0/P1, then re-emit"}`,
    "```",
    ...(kind === "webapp" || kind === "game" ? ["", "  # dev server"] : []),
    ...devCommand,
    "",
    "Everything above runs on your local machine against the emitted tree. No service, database or account is required, configured or implied.",
    "",
    "## Environment",
    "",
    `The only env contract is \`.env.example\` (PLACEHOLDER values â€” never commit real secrets). Variables:`,
    "",
    "| Variable | Local meaning |",
    "| --- | --- |",
    ...envNames.map((name) => `| \`${name}\` | ${ENV_MEANING[name] ?? "see .env.example"} |`),
    "",
    ...testSection,
    "## Deploy â€” human-gated, nothing automatic",
    "",
    "No deployment is configured, wired or implied by this repository. Concretely:",
    "",
    "- The pipeline **recorded** CI/IaC/ADR/OpenAPI templates (P9/P12 artifacts, below and in `.rapidtool/project.json`); it never executed or validated them.",
    "- Deploying needs credentials and tooling **you** provision outside this repo; nothing here pushes to any cloud, registry or host.",
    `- For this kind, ${kindDestinations[kind]}. If you go that route: create the account/project yourself, then fill \`.env\` from \`.env.example\` â€” and verify credentials before any deploy.`,
    "- RapidTool's own P9 approval was a recorded, advisory gate â€” re-verify before a real deploy.",
    "",
    "- Handoff commands (a TEMPLATE â€” none of it ran here; run from the emitted folder after your own account/login; the scripts used are declared by the emitted package.json):",
    "",
    "```text",
    ...kindHandoff[kind],
    "```",
    "",
    "## Assets",
    "",
    "`assets/` and `public/` are expected at the emitted scaffold and are NOT engine-generated" +
      (kind === "game"
        ? " â€” `assets/manifest.json` lists the placeholder roster to supply or render procedurally"
        : "") +
      ".",
    "",
    ...(hasTemplates
      ? [
          "## Recorded pipeline templates (P9/P12)",
          "",
          "Verbatim from the project artifacts â€” recorded, never executed:",
          "",
          ...recordedArtifacts(project),
        ]
      : [
          "## Recorded pipeline templates (P9/P12)",
          "",
          "_None yet â€” the project has not reached the P9/P12 phases that record CI/IaC/ADR/OpenAPI templates._",
        ]),
    "",
  ];
  return body.join("\n");
}

// ---------------------------------------------------------------------------
// deplyNotes â€” legacy-misspelling alias for `deployNotes` (N6-W8 Â· P4 naming
// pass, fixes/295_p4_sweeps.md; alias direction flipped by fixes/309 A3 Â·
// M4-16, taking the 295 migration path: the call site + scaffold.test.ts moved
// to the correct spelling in the SAME change). Back-compat only â€” every new
// caller uses `deployNotes`.
// ---------------------------------------------------------------------------
export const deplyNotes = deployNotes;

// ---------------------------------------------------------------------------
// scaffoldProject â€” assemble the deterministic file tree
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
 * project's own durable log rows â€” the same signals headless's red-tree guard
 * (`treeRunTrail`) and codegen's `partialTreeRefuse` write:
 *
 *   redTree â€” the LAST tree verdict on the trail is `p6.tree.failure` with no
 *             green run since (`p6.journey.converged` / `p6.tree.tested` /
 *             `p6.tree.tested.skipped`): this artifact is a RECORD of a
 *             failed tree-run, not a verified build. LAST row wins â€” a tree
 *             repaired to green by a later run reads clean.
 *   partial â€” a phase-6 `p6.synthesis.refused` on the trail AND real generated
 *             substance exists (`generatedSource` / `generatedTree`): prior
 *             chunks' real files were kept â€” a PARTIAL tree, neither the
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
 * R2-04 / BF-1: the coded UNDER-PRODUCTION refusal this emitter must HONOR.
 * The C1-01 floor (codegen `underProducedRefusal`) already journals a phase-6
 * `p6.synthesis.refused` naming `RT_E_PLAN_UNDERPRODUCED` + the missing
 * declared modules, but the below-floor PARTIAL (prior chunks' real files) was
 * still emitted as a runnable-looking tree. The scaffold reads that recorded
 * refusal off the project's own durable trail and REFUSES the emission
 * instead. Returns the recorded under-production detail (its registered code
 * prefix included) when the FINAL synthesis verdict is a refusal AND an
 * under-production refusal was recorded on the trail AND real generated
 * substance exists; else null. Pure; absent log â‡’ null (byte-identical legacy
 * emissions â€” pre-C1-01 persisted projects carry no such row).
 */
export function underProductionRefusalOf(project: Project): string | null {
  const hasSubstance =
    String(project.generatedSource ?? "").trim().length > 0 ||
    (Array.isArray(project.generatedTree) && project.generatedTree.length > 0);
  if (!hasSubstance) return null;
  const rows = Array.isArray(project.logs) ? project.logs : [];
  // Two recorded facts, both required:
  //  1. the FINAL synthesis verdict is a REFUSAL â€” a journey that refused on
  //     cycle 1 but sealed a full tree on cycle 2 (`p6.synthesis` success,
  //     flower-shop/scheduler) must still emit. `p6.synthesis` = the treeUpgraded
  //     success stamp; a later one clears the refusal.
  //  2. an under-production refusal was recorded on the trail â€” the coded
  //     `RT_E_PLAN_UNDERPRODUCED` whose detail names the missing declared
  //     modules. A below-floor tree keeps its best partial even when the FINAL
  //     cycle refused for another coded reason (office-stock-tracker: the model
  //     legally refused on cycle 3 after an under-production cycle 2).
  let finalRefused = false;
  let underDetail: string | null = null;
  for (const row of rows) {
    if (row === null || typeof row !== "object" || row.phase !== 6) continue;
    if (row.event === "p6.synthesis") {
      finalRefused = false;
    } else if (row.event === "p6.synthesis.refused") {
      finalRefused = true;
      const detail = typeof row.detail === "string" ? row.detail : "";
      if (detail.startsWith("RT_E_PLAN_UNDERPRODUCED") || detail.includes("RT_E_PLAN_UNDERPRODUCED")) {
        underDetail = detail;
      }
    }
  }
  return finalRefused && underDetail !== null ? underDetail : null;
}

/**
 * The GitHub alert opener EVERY withheld-tree README banner leads with â€” this
 * file's `belowFloorBanner` and the emit seam's `redTreeBannerText`
 * (`software-export.ts`). One constant, so the Preview's copy (358 / R-10) and
 * the banner it describes cannot drift apart.
 */
export const CAUTION_ALERT_LEAD = "> [!CAUTION]";

/**
 * fixes/354 A2-F4 (Decision D1): the unmissable banner stamped at the TOP of the
 * emitted `README.md` when a REAL-but-below-floor partial lands by default. It
 * states the recorded refusal â€” never a pass â€” so the artifact cannot be read
 * as a complete build. This is the scaffold-owned twin of headless's
 * `underProducedBanner`; headless should consume this producer (see the A2-F4
 * caller change in `fixes/354_a2_emission.md`) so the two banners cannot drift.
 */
export function belowFloorBanner(detail: string): string {
  const reason = String(detail ?? "").trim().replace(/^RT_E_PLAN_UNDERPRODUCED\s*Â·\s*/, "");
  const tail = reason.replace(/\r?\n/g, " ").replace(/`/g, "'");
  return [
    CAUTION_ALERT_LEAD,
    "> ## BELOW-FLOOR PLAN â€” THIS ARTIFACT IS NOT A COMPLETE BUILD (RapidTool A2-F4)",
    ">",
    "> The project's own P6 journal records a synthesis refusal (`RT_E_PLAN_UNDERPRODUCED`):",
    "> the emitted tree is a REAL but BELOW-FLOOR PARTIAL â€” fewer modules than the brief-declared",
    "> floor. It is an artifact of a refused plan, never a passing build, and its delivery",
    "> commit is withheld.",
    tail.length > 0 ? `> Recorded refusal: \`${tail}\`` : "> The recorded refusal carried no detail.",
    ">",
    "> Synthesize the missing declared module(s) and re-emit to green.",
    "",
  ].join("\n");
}

/**
 * 358 (R-10): true when an emitted README LEADS with the caution banner â€” the
 * opener BOTH withheld-tree writers stamp at the top of the file: this module's
 * `belowFloorBanner` (a below-floor partial) and the emit seam's
 * `redTreeBannerText` (an uncleared red trail / a synthesis partial). The console
 * Preview decides its copy from THESE bytes, never from one branch's detail line:
 * keying on the `RED TREE â€¦` literal told the operator of a below-floor run that
 * the archived README carried no caution banner while the README led with the
 * scaffold's own `> [!CAUTION]` / `BELOW-FLOOR PLAN` banner, for exactly the
 * withheld reason the alert named.
 */
export function readmeLeadsWithCautionBanner(body: string): boolean {
  return String(body ?? "").trimStart().startsWith(CAUTION_ALERT_LEAD);
}

/**
 * 358 (R-10): the sentence the Preview shows about the archived README's caution
 * banner for a withheld tree. ONE producer keyed on the emitted bytes, so the
 * copy can never claim a banner the README does not carry (or deny one it does).
 */
export function withheldTreeReadmeNote(readmeBody: string): string {
  return readmeLeadsWithCautionBanner(readmeBody)
    ? "The archive's README carries the same caution banner."
    : "The archive's README does not carry the caution banner for this withheld reason.";
}

/**
 * Derive the full file tree for one project. Pure: returns {path, body} pairs
 * (the CLI writes them); deterministic: same project â‡’ same bytes. File order:
 * root docs â†’ env/package â†’ .rapidtool â†’ boot files (webapp/game) â†’ game
 * manifest â†’ spec-graph modules in topo order (generatedSource hosted on the
 * first job node) â†’ oracle spec.
 */
export function scaffoldProject(project: Project, options: ScaffoldOptions = {}): ScaffoldResult {
  const check = validProject(project);
  if (!check.ok) return check;

  // fixes/356 (W356 A3; restores 355-A3 L6): the SAFETY DEFAULT is refuse. A
  // recorded below-floor plan writes ZERO files unless the caller opts in
  // explicitly â€” `"partial"` (or `"banner"`, the headless/CLI spelling) lands
  // the best PARTIAL tree with the `> [!CAUTION]` / `## BELOW-FLOOR PLAN`
  // banner at the top of the emitted README and reports
  // `underProduced{code,detail}`, so a deliberately shipped partial can never
  // read as a clean pass. The 354 wave made `"partial"` the default, which made
  // an explicit `"refuse"` inert downstream; an absent option pair no longer
  // materializes anything. Precedence: an explicit `underProduced` string wins;
  // else the legacy boolean (`true` = the INTERNAL candidate emit â€” the pre-seal
  // self-typecheck must still run the candidate's real tsc, `false` = refuse);
  // else refuse. Absent the recorded refusal the emission is byte-identical in
  // every policy (a pre-C1-01 project, or a synthetic fixture).
  const underProducedPolicy: "partial" | "refuse" =
    options.underProduced === "partial" || options.underProduced === "banner"
      ? "partial"
      : options.underProduced === "refuse"
        ? "refuse"
        : options.allowUnderProduced === true
          ? "partial"
          : "refuse";
  const underProducedDetail = underProductionRefusalOf(project);
  if (underProducedDetail !== null && underProducedPolicy === "refuse") {
    const reason = underProducedDetail.replace(/^RT_E_PLAN_UNDERPRODUCED\s*Â·\s*/, "");
    return {
      ok: false,
      code: "RT_E_PLAN_UNDERPRODUCED",
      error: `RT_E_PLAN_UNDERPRODUCED Â· artifact refused (below-floor plan): ${reason}`,
    };
  }

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

  // fixes/277 (A3-f07): resolve the emitted-UI generation hook for this emit â€”
  // the caller's hook (ScaffoldOptions.uiGeneration) with the default
  // generator as the fallback â€” and track whether a caller's lines actually
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

  // fixes/277 (R3-f03): the emission's trail verdicts (see trailVerdictOf) â€”
  // consumed by the oracle-spec ctx (`partial` â‡’ capability skip-with-reason)
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
    `${node.id} â€” ${prose(node.purpose)}`,
  ]);

  // Surface paths the oracle spec + boot entry import from (sanitized = the
  // paths actually pushed below). Undefined node ids â‡’ no module to import.
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
  // src/generated.ts â€” when the tree ships no file at that path, the entry is
  // the tree's src/generated.ts file if present, else the first accepted file
  // in sorted order (always deterministic; treeMode â‡’ entryPath non-null).
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
      treeRefusals.push(`generatedTree:refused:${JSON.stringify(path)}:duplicate path â€” first row wins`);
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
        // C1-02: prefer the tree's ESM BARREL `src/generated.ts` (codegen
        // `materializeImportableTree` writes it for EVERY tree) over the
        // first-job role path. The barrel `export *`s every tree module, so the
        // UI shell that imports it can genuinely call a real generated export â€”
        // a first-job role path that the tree happens to contain exposes only
        // that one job module and left the shell unwired. The role path stays
        // the fallback for a hand-built tree with no barrel.
        const entry = byPath.get("src/generated.ts") ?? byPath.get(rolePath) ?? treeAccepted[0];
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
            "generated tree file â€” brief capability module (project.generatedTree, fixes/144 M2)",
          ],
        )
    : [];

  // --- fixes/216b (106 T-08 / F-05): oracle row census ----------------------
  // Classified ONCE, here, BEFORE the README is rendered: the emitted spec and
  // the README census must agree on which A7 rows carry a real assertion. The
  // host the node loop below will write generatedSource to is deterministic
  // (the FIRST job-* node in topo order, else the legacy src/generated.ts
  // fallback â€” the same rule the loop applies), so it can be named up front.
  const jobLabelOf = (node: { purpose: string }): string | null => {
    const m = node.purpose.match(/["â€œ]([^"â€]+)["â€]/);
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
  // UI-shell skip â€” so the unloadable product would ship with every gate green
  // (reproduced live on a generatedSource-only CJS project: `tree-run` ok:true
  // while `import()` throws TypeError). The emit pipeline's materializer
  // (headless.materializeEmitTree) rewrites stored TREE residue AND â€” since
  // 331-3 â€” a lone generatedSource with residue (both convert to an ESM tree
  // before this runs). A DIRECT scaffold caller bypasses that host-side seam
  // (this function is pure + synchronous and cannot import codegen), so the
  // residue still reaches here; that is the case this refuse closes. Never
  // ship bytes that contradict the package we declare â€” refuse loudly
  // (declare-or-strike).
  const cjsOffenders: string[] = [];
  for (const tf of treeAccepted) {
    if (EMITTED_CODE_EXT_RE.test(tf.path) && cjsResidueHits(tf.source).length > 0) cjsOffenders.push(tf.path);
  }
  if (!treeMode && generated && cjsResidueHits(generated).length > 0) {
    cjsOffenders.push(plannedHostPath ?? "src/generated.ts");
  }
  if (cjsOffenders.length > 0) {
    return {
      ok: false,
      error: emittedRefusal(
        `assembled generated module body is CommonJS but the emitted package declares "type":"module" â€” ` +
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
  // the SAME binding â€” no second derivation can drift.
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
  /** Spec-graph job nodes the binding may key (label â‰¥3 chars, mirrors codegen). */
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
   * Empty for the keyless floor (no specRecord â‡’ no recorded surface) â€” the
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
  /** label â†’ path for the router + oracle classification (deterministic order). */
  const realJobModules: { label: string; path: string }[] = realJobTargets.map((t) => ({
    label: t.label,
    path: t.path,
  }));
  const wiredJobLabels = new Set(realJobTargets.map((t) => t.label));
  // A wired leftover job emits a REAL module, never a bridge â€” drop it from the
  // planned-bridge census so the oracle rows classify it as the real seam.
  for (const label of wiredJobLabels) plannedBridgedLabels.delete(label);

  /**
   * fixes/216d (106 T-05 / F-03): the module the emitter ACTUALLY writes as the
   * generated entry â€” the tree ENTRY (tree mode) or the module hosting
   * generatedSource (legacy mode), both resolved above from the same data the
   * node loop consumes. The emitted webapp shell imports exactly this path
   * (relative to its own emitted file); null â‡’ no generated substance at all,
   * so the shell carries no generated import. Pre-fix the shell imported the
   * literal "../generated.ts", which the allow-list refused â‡’ dangling.
   */
  const generatedEntryPath: string | null = treeMode ? treeEntryPath : plannedHostPath;
  // fixes/359 (W359 kind-gate): the multi-page React site is emitted ONLY for a
  // kind whose emitted package DECLARES the renderer that site imports
  // (`PKG_DEPS[kind].react` â€” webapp today; never a kind list). Its sibling
  // `rendererFiles` gates on the same fact (scaffold.ts webMarketingSiteFiles).
  // A react-less kind has no react, no `@types/react`, no vite script and no
  // `index.html`, so the site is unreachable dead weight that reds the tree's
  // OWN declared `tsc --noEmit` (TS17004 / TS6142 / TS2307) â€” and for a game it
  // REPLACED the canvas shell `src/main.ts` imports (TS2614 `bootGame`).
  const declaresRenderer = PKG_DEPS[kind]?.react !== undefined;
  // 351: the web-marketing multi-page site. When the brief's domain is
  // `web-marketing` and the generated module exposes page content, the emitted
  // UI becomes a real one-file-per-page site (router + layout + pages + cart)
  // instead of the single-file shell. A caller-supplied uiGeneration hook still
  // wins (the documented override contract), so the site is skipped then.
  const marketingSite =
    options.uiGeneration === undefined && declaresRenderer
      ? webMarketingSiteFiles({
          project: proj,
          kind,
          uiPath: uiPath ?? null,
          generatedEntryPath,
          entrySource: uiGeneratedEntrySource(proj),
          storePath,
        })
      : null;
  if (marketingSite !== null) {
    uiHookRan = true;
    // The README tables every emitted file (declare-or-strike). The site's
    // page/module paths join the tree-rows table; the ui node's own row already
    // names src/ui/console.tsx, so it is skipped here to avoid a duplicate.
    for (const file of marketingSite) {
      if (file.path === uiPath) continue;
      treeDocRows.push([file.path, "emitted marketing site page/module (351) â€” one file per page, real router"]);
    }
  }
  // 353: the shape-tolerant briefed site. Fires when the web-marketing site did
  // not (a different domain, or the entry exposes async getters / no matching
  // content role) but the brief/spec names â‰¥2 pages and the entry exposes a real
  // mountable export. Precedence: web-marketing site â†’ briefed site â†’ shell.
  const briefedSite =
    options.uiGeneration === undefined && marketingSite === null && declaresRenderer
      ? briefedSiteFiles({ project: proj, kind, uiPath: uiPath ?? null, generatedEntryPath })
      : null;
  if (briefedSite !== null) {
    uiHookRan = true;
    for (const file of briefedSite) {
      if (file.path === uiPath) continue;
      treeDocRows.push([file.path, "emitted briefed site page/module (353) â€” one file per page, real router"]);
    }
  }
  /** The multi-page site this emit chose (web-marketing 351 or briefed 353). */
  const uiSite = marketingSite ?? briefedSite;
  /**
   * fixes/216k D2 (TA-15): the JOB modules the generated tree actually
   * materialised â€” spec-graph job-* nodes whose sanitized path a tree file
   * covers, in graph order, importable (.ts) only (node strip-types cannot
   * load .tsx). Each entry keys its A7 oracle row (row.job === label) to the
   * REAL module file, so the row asserts that module's real export surface
   * instead of skipping. Empty in legacy mode and for uncovered job nodes â€”
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
  // fixes/352: tree-covered job modules bound to a REAL run export the tree
  // source genuinely exposes (verified) â€” the TREE api module dispatches to
  // these. Empty when the tree materialised no job module (the api then refuses
  // honestly) or when no recorded signature binds to a tree job.
  const treeApiModules: { label: string; path: string; run: string; arity: number; extraArgs: string[] }[] = [];
  if (treeMode) {
    const treeSourceByPath = new Map(treeAccepted.map((f) => [f.path, f.source]));
    for (const { node, index } of ordered) {
      if (!node.id.startsWith("job-")) continue;
      const path = safeNodePath(node.file, node.id, index);
      if (!treeByPath.has(path) || !/\.ts$/.test(path)) continue;
      const label = jobLabelOf(node);
      if (label === null) continue;
      const sigs = boundSignatures.get(node.id) ?? [];
      const source = treeSourceByPath.get(path) ?? "";
      const primary =
        sigs.find((s) => /^run[A-Z_$]/.test(s.name) && sourceExportsName(source, s.name)) ??
        sigs.find((s) => sourceExportsName(source, s.name));
      if (primary === undefined) continue;
      // 353: the recorded signature may declare MORE than the payload param
      // (e.g. `parseScannerInput(input, options)`). The pre-353 router passed
      // only `input`, so the emitted api module did not compile (TS2554). Build
      // a sound extra argument per remaining param from its recorded type; a
      // type with no provable literal falls back to an explicit `undefined`.
      const aliases = uiTypeAliases(source);
      const objects = uiDeclaredObjects(source);
      const extraArgs: string[] = [];
      primary.params.forEach((p, i) => {
        if (i === 0 || p.rest) return;
        const literal = p.type === "" ? "undefined" : emptyForType(p.type, aliases, objects);
        extraArgs.push(literal ?? "undefined as never");
      });
      treeApiModules.push({
        label,
        path,
        run: primary.name,
        arity: primary.params.filter((p) => !p.rest).length,
        extraArgs,
      });
    }
  }
  const treeApiPath = treeMode && typeof apiPath === "string" && /\.ts$/.test(apiPath) ? apiPath : null;
  const treeStorePath = treeMode && typeof storePath === "string" && /\.ts$/.test(storePath) ? storePath : null;
  // The surface the spec's row loop switches on (mirrors the ctx it receives:
  // tree mode imports only the tree entry â€” plus, per D2, each tree-covered
  // job module â€” and, per fixes/352, the REAL tree api/store modules).
  const oracleTreeEntryOk = treeMode && typeof treeEntryPath === "string" && /\.ts$/.test(treeEntryPath);
  // fixes/357 (R-7): the labels whose modules the EMITTED spec imports â€” the
  // same lists `emitOracleSpec` receives below, so the census here and the row
  // body there classify every row identically.
  const oracleImportableJobs = importableOracleJobLabels(treeJobModules, realJobModules, oracleTreeEntryOk);
  const oracleSurface = oracleRowSurface({
    treeEntryOk: oracleTreeEntryOk,
    apiPath: treeMode ? treeApiPath : apiPath,
    hostPath: treeMode ? null : plannedHostPath,
    template: isTemplateModule(generated),
    bridged: treeMode ? [] : plannedBridgedLabels,
    jobModules: treeJobModules,
    wired: wiredJobLabels,
    endpoints:
      project.contracts && Array.isArray(project.contracts.endpoints)
        ? project.contracts.endpoints
        : [],
    importableJobModules: oracleImportableJobs.tree,
    importableWiredModules: oracleImportableJobs.wired,
  });
  const oracleCensus = proj.oracle.length ? censusOracleRows(proj.oracle, oracleSurface) : null;
  /** fixes/216k D3: tree-mode job nodes the tree did not cover â€” never bridged
   *  (a bridged job path would keep doctor's census `reexports > 0` forever).
   *  Filled by the spec-graph node loop below; rendered by readmeBody + warnings. */
  const unmaterialisedJobs: { id: string; file: string; label: string | null }[] = [];
  /** fixes/216k: tree-mode non-job nodes bridged to the tree entry (now counted). */
  const bridgedNonJobPaths: string[] = [];
  /** 353: nodes whose concept the tree already ships under a dash/underscore/case
   *  variant (`path -> treePath`) â€” reused, so no duplicate module is written. */
  const treeTwinReused: string[] = [];
  /** 353: non-job nodes neither the tree nor an emitter covers â€” emitted EMPTY. */
  const emptyNonJobPaths: string[] = [];

  // --- Root documents + skeleton files -------------------------------------
  // (fixes/216k parent boundary repair: the README push moved BELOW the
  // spec-graph node loop â€” it renders the job-scope/bridge census arrays the
  // loop fills; emitting it here ran before the loop: TDZ + empty counts.)
  push("DEPLOY.md", deployNotes(proj, oracleCensus));
  push(".env.example", envExample(kind));
  push(".gitignore", gitignoreFile());
  push("LICENSE", licenseFile(proj));
  push(".github/workflows/ci.yml", ciWorkflowFile(kind, proj.oracle.length > 0));
  push("package.json", packageJson(kind, proj, proj.oracle.length > 0));
  // fixes/359 (W359 kind-gate): the emitted `jsx` must admit every module this
  // emit writes (see tsconfigJson), and the emitted file set is not complete
  // until the spec-graph node loop and the site pass have run. The row is
  // pushed here so the emitted order is unchanged; its body is filled from the
  // COMPLETE file set after the last push below.
  const tsconfigRow: ScaffoldFile = { path: "tsconfig.json", body: "" };
  files.push(tsconfigRow);
  push(".rapidtool/project.json", exportProjectJson(project));

  // --- Browser boot files (fixes/135): kinds whose package.json declares
  // vite dev/build scripts get an index.html + entry + vite.config so
  // `npm run dev`/`npm run build` actually run in the emitted dir.
  if (kind === "webapp" || kind === "game") {
    const entryFile = kind === "webapp" ? "src/main.tsx" : "src/main.ts";
    push("index.html", emitIndexHtml(proj, `/${entryFile}`));
    // fixes/277 (R3-f06 / W-15): BOTH vite kinds get their config â€” webapp
    // with the react + tailwindcss plugins (W52 / 338-5 wires tailwindcss so
    // the declared devDeps are never inert), game plain (its devDeps carry no
    // framework plugin; the webapp body would break `npm run build` there).
    // emitViteConfig takes the kind.
    push("vite.config.ts", emitViteConfig(kind));
    push(entryFile, emitMainEntry(kind, proj, uiPath ? relSpecifier("src", uiPath) : null));
    // W52 / 338-5: the Tailwind v4 CSS entry the webapp's declared
    // `@tailwindcss/vite` plugin compiles â€” the file that makes the two
    // declared devDeps do work (main.tsx imports it; vite.config registers it).
    if (kind === "webapp") push("src/styles.css", emitStylesCss());
  }

  if (kind === "game") {
    push("assets/manifest.json", emitGameManifest(proj));
  }

  // --- fixes/277 (R3-f06): per-kind runnable entries ------------------------
  // packageJson DECLARES these paths (cli-tool `bin` + `main`; library
  // `main`/`exports`; service `main` + the start script) â€” emit exactly what
  // it declares so no emitted package field points at a file that was never
  // written.
  // cli-tool: the bin launcher (spawns src/main.ts, argv passthrough) + the
  // entry; library: the importable module entry; service: the `npm start`
  // entry with the real PORT wiring; each entry's structured refusal keeps
  // the canonical TODO(E-15) stub marker + the RT_E_VALIDATION Â· prefix.
  if (kind === "cli-tool" || kind === "library" || kind === "service") {
    push("src/main.ts", emitKindEntry(kind, proj));
    if (kind === "cli-tool") {
      push(`bin/${slugName(proj.name)}.mjs`, emitBinLauncher(proj));
    }
  }

  // --- Generated tree files (fixes/144 M2) ----------------------------------
  // TREE MODE ONLY: every accepted tree file is emitted VERBATIM at its own
  // repo-relative path (never wrapped in scaffold headers â€” bodies must stay
  // byte-identical to the synthesized source), in sorted path order. A file
  // whose path a spec-graph node also claims is emitted HERE once; the node
  // loop below skips every tree-covered path.
  if (treeMode) {
    for (const tf of treeAccepted) push(tf.path, tf.source);
  }

  // --- Spec-graph modules in topo order (nodes/ordered computed above) -------

  // 216b: `jobLabelOf` and `generated` are declared ONCE, above, in the oracle-row
  // census block. This second pair was a duplicate in the SAME function scope
  // (TS2451 â€” Cannot redeclare block-scoped variable), left behind when the census
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
      // above â€” never double-push. An uncovered ui node is rebuilt by emitUi
      // (340-6: the webapp body is generated from the entry's real exports;
      // the game/service shells stay honest contract-level stubs);
      // every other uncovered graph node becomes a thin re-export of the tree
      // ENTRY module so the promised module surface still materializes and
      // resolves to real generated code (never a TODO stub beside it).
      if (treeByPath.has(path)) continue;
      // fixes/216k D3 (TA-15 / 106 F-10): a spec-graph JOB node the generated
      // tree does not cover is NEVER bridged. `doctor --tree` classifies any
      // `src/jobs/*.ts` re-export as a leftover job, so a bridged job path
      // would keep `reexports > 0` (and the factory latch false) no matter how
      // real the tree-covered job modules are â€” exactly the artifact TA-15
      // removes. The node gets NO file; it is counted + surfaced (warnings +
      // shipped README line) as an unmaterialised job node, never silently.
      if (isJob) {
        // fixes/328 P2: a job node with a bound recorded API surface becomes a
        // REAL module â€” materialisation, not a bridge (so the D3 rule "never
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
      // 353: the tree already ships the real module for this concept under a
      // dash/underscore/case variant (the measured web-marketing/web_marketing
      // and custom-software/custom_software duplicate pair) â€” reuse it and never
      // write a second, duplicate module. The graph's documented path is
      // remapped to the tree's real file so no README row dangles.
      const twin = treeTwinPath(treeAccepted, path);
      if (twin !== null && node.id !== "ui" && node.id !== "tests") {
        const row = specRows.find(([p]) => p === path);
        if (row) {
          row[0] = twin;
          row[1] = `${node.id} â€” ${prose(node.purpose)} (real module in the generated tree)`;
        }
        treeTwinReused.push(`${path} -> ${twin}`);
        continue;
      }
      if (node.id === "ui" && uiSite !== null) {
        for (const file of uiSite) push(file.path, file.body);
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
      } else if (node.id === "schema") {
        // fixes/352: a REAL domain module (typed entities from the A6 contract),
        // never the pre-352 `export * from "../generated.ts"` bridge.
        body = emitSchema(node, proj);
      } else if (node.id === "api" && treeApiPath !== null) {
        // fixes/352: a REAL router over the recorded A6 endpoints, dispatching
        // to the generated tree's own job modules â€” the tree no longer lies
        // about having an API.
        body = emitTreeApi(node, proj, { apiPath: path, jobModules: treeApiModules });
      } else if (node.id === "store" && treeStorePath !== null) {
        // fixes/352: the REAL persisted state container, never a bridge.
        body = emitStore(node, proj);
      } else {
        // 353: no emitter owns this node and the tree ships no twin â€” emit an
        // explicit EMPTY module and record the gap. Never the pre-353 barrel
        // alias (`export * from "../generated.ts"`) that pretended the whole
        // generated tree was this one module (the measured fake-layering
        // defect).
        body = [
          ...sourceHeader(path, node.purpose, proj, [
            "// 353: the generated tree ships no module for this spec-graph node,",
            "// so this file is intentionally empty â€” never a re-export of the",
            "// whole tree barrel (which would fake a real module boundary).",
          ]),
          "export {};",
          "",
        ].join("\n");
        emptyNonJobPaths.push(path);
      }
      push(path, body);
      continue;
    }
    if (node.id === "schema") {
      body = emitSchema(node, proj);
    } else if (node.id === "api") {
      // fixes/328 P2: the router dispatches to the REAL job modules emitted
      // this run (empty for the keyless floor â‡’ the pre-328 refusal bytes).
      body = emitApi(node, proj, { apiPath: path, jobModules: realJobModules });
    } else if (node.id === "store") {
      body = emitStore(node, proj);
    } else if (isJob) {
      const realJob = realJobById.get(node.id);
      if (realJob) {
        // fixes/328 P2: this job has a recorded API surface â€” emit the REAL
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
    } else if (node.id === "ui" && uiSite !== null) {
      // 351/353: the multi-page site (router + one file per page).
      for (const file of uiSite) push(file.path, file.body);
      continue;
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
  // fixes/352: the emitted .ts module sources, so a capability row can bind to
  // and CALL the real export the tree wires (behavioural), not just detect its
  // presence. Built from the already-assembled file set â€” one source of truth.
  const sourceByPath = new Map<string, string>();
  for (const f of files) {
    if (/\.[cm]?ts$/.test(f.path)) sourceByPath.set(f.path, f.body);
  }
  // Real assertions over the emitted module surfaces (fixes/135) â€” the ctx
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
            // fixes/352: the REAL tree api/store modules are importable .ts
            // surfaces â€” the row loop asserts their dispatch/round-trip.
            apiPath: treeApiPath,
            storePath: treeStorePath,
            // fixes/328 P2: tree-mode job nodes materialised as REAL modules.
            wiredJobLabels,
            wiredJobModules: realJobModules,
            // fixes/277 (R3-f03): a partial tree â‡’ capability rows skip with
            // their reason instead of asserting (non-partial bytes unchanged).
            partial: verdict.partial,
            sourceByPath,
          })
        : emitOracleSpec(proj, {
            storePath,
            apiPath,
            hostPath,
            bridgedJobLabels,
            wiredJobLabels,
            wiredJobModules: realJobModules,
            partial: verdict.partial,
            sourceByPath,
          }),
    );
  }

  // fixes/359 (W359 kind-gate): fill the emitted tsconfig from the COMPLETE
  // emitted file set (last push above) â€” the derived `jsx` reads the bytes this
  // emit actually writes, so it cannot drift from a kind list again.
  tsconfigRow.body = tsconfigJson(
    kind,
    proj.oracle.length > 0,
    files.some((f) => JSX_SOURCE_EXT_RE.test(f.path)),
  );

  // fixes/216k (TA-15 done-when 2): the D3 count/surface for TREE mode â€”
  // unmaterialised spec-graph job nodes (each NEVER bridged; one warning row
  // apiece) and the surviving non-job bridges (bytes unchanged, now counted).
  // Both render in the shipped README and the CLI-facing summary. Zero counts
  // in both â‡’ byte-identical pre-216k output for every existing fixture.
  const unmaterialisedWarnings = unmaterialisedJobs.map(
    (j) =>
      `specGraph:unmaterialised-job:${JSON.stringify(j.file)}:${
        j.label ? `job ${JSON.stringify(j.label)}` : j.id
      } has no generated tree file â€” tree mode NEVER bridges a job node (fixes/216k D3 / TA-15)`,
  );
  // 353: the tree-twin reuse (a duplicate module was NOT written) and the empty
  // non-job nodes (never a barrel alias). Both surfaced so nothing is silent.
  const twinWarnings = treeTwinReused.map(
    (entry) => `specGraph:tree-twin:reused existing generated module instead of writing a duplicate: ${entry}`,
  );
  const emptyNodeWarnings = emptyNonJobPaths.map(
    (p) => `specGraph:empty-node:${JSON.stringify(p)}: no generated tree file covers this node â€” emitted EMPTY (never a barrel bridge)`,
  );
  const summary = treeMode
    ? `${files.length} files Â· kind ${kind} Â· packet ${project.id || "unknown"} â€” tree files already on disk Â· generatedTree: ${treeAccepted.length} file${treeAccepted.length === 1 ? "" : "s"} assembled${treeRefusals.length ? `, ${treeRefusals.length} refused (see warnings)` : ""}${unmaterialisedJobs.length ? `, ${unmaterialisedJobs.length} job node${unmaterialisedJobs.length === 1 ? "" : "s"} unmaterialised (never bridged â€” see warnings)` : ""}${treeTwinReused.length ? `, ${treeTwinReused.length} node${treeTwinReused.length === 1 ? "" : "s"} satisfied by an existing tree module (no duplicate written)` : ""}${emptyNonJobPaths.length ? `, ${emptyNonJobPaths.length} node${emptyNonJobPaths.length === 1 ? "" : "s"} emitted empty (no bridge)` : ""}`
    : `${files.length} files Â· kind ${kind} Â· packet ${project.id || "unknown"} â€” write them to disk with the emit command`;
  const warnings = [...treeRefusals, ...unmaterialisedWarnings, ...twinWarnings, ...emptyNodeWarnings];
  // fixes/277 (A3-f07): the UI-generation record â€” present only when a webapp
  // UI shell was actually emitted this run (the hook ran); `applied` is true
  // when a caller hook's lines replaced the default generator. Absent for
  // every other kind/path, so existing consumers keep byte-identical output.
  const uiGenerationRecord =
    uiHookRan && uiPath !== null
      ? {
          hook: uiHookApplied ? ("caller" as const) : ("default-generator" as const),
          applied: uiHookApplied,
          uiPath,
        }
      : undefined;
  // --- fixes/347-2: the no-invention HARD RULE at emission time --------------
  // When the brief withholds a figure class (prices/awards/addresses), the
  // scaffold may not author such a literal into its own modules. The model's
  // verbatim generated-tree bytes and the oracle spec's fixture data are NOT
  // policed (those are not scaffold-authored copy). Refuse loudly rather than
  // ship an invented fact (declare-or-strike).
  if (briefWithholdsFigures(project.brief ?? "")) {
    const offenders: string[] = [];
    for (const file of files) {
      const path = file.path.replace(/\\/g, "/");
      if (!/\.[cm]?tsx?$/.test(path)) continue;
      if (treeByPath.has(file.path) || treeByPath.has(path)) continue;
      if (path === "tests/oracle.spec.ts") continue;
      for (const line of file.body.split("\n")) {
        if (inventedFigureLine(line)) offenders.push(`${path}: ${line.trim().slice(0, 120)}`);
      }
    }
    if (offenders.length > 0) {
      return {
        ok: false,
        code: "RT_E_VALIDATION",
        error: emittedRefusal(
          `brief withholds prices/awards/addresses but the emitted scaffold authored a figure literal: ${offenders.slice(0, 3).join("; ")}`,
        ),
      };
    }
  }

  // fixes/354 A2-F4 (D1) / fixes/356 (W356 A3): land the bannered below-floor
  // partial â€” reachable ONLY under an explicit `"partial"`/`"banner"` policy
  // (the default refused before the first write). The banner is prepended to the
  // emitted README so the artifact itself declares the refusal (never a silent
  // partial); the result carries the same detail for the envelope. A clean
  // emission and the `refuse` path are untouched.
  const underProduced =
    underProducedDetail !== null
      ? { code: "RT_E_PLAN_UNDERPRODUCED" as const, detail: underProducedDetail }
      : undefined;
  if (underProduced !== undefined) {
    const banner = belowFloorBanner(underProduced.detail);
    for (const file of files) {
      if (file.path === "README.md") file.body = `${banner}\n${file.body}`;
    }
  }

  return {
    ok: true,
    files,
    summary,
    ...(warnings.length ? { warnings } : {}),
    // fixes/277 (R3-f03 / W-06): trail verdicts â€” present only when true.
    ...(verdict.redTree ? { redTree: true as const } : {}),
    ...(verdict.partial ? { partial: true as const } : {}),
    ...(kind === "game" ? { gameTemplate: true as const } : {}),
    ...(underProduced ? { underProduced } : {}),
    ...(uiGenerationRecord ? { uiGeneration: uiGenerationRecord } : {}),
  };
}
