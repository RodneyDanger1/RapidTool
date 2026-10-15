/**
 * Product-quality reading (additive, 2026-10-05).
 *
 * WHAT THIS IS. An ADDITIVE, byte-derived reading that asks the question the
 * DoD gates do not: is what actually landed a *product*? Every value below is
 * derived from bytes the caller hands in — a project record's `generatedTree`
 * (plus, optionally, an emitted file list) and its artifact census. Absent
 * evidence is reported ABSENT with a reason; nothing is inferred, guessed or
 * fabricated.
 *
 * WHY IT EXISTS. The existing gates measure internal consistency, not product
 * value: `p6-brief-fit` is a lexical identifier test (`dod.ts`), `p6-arch`
 * PASSES VACUOUSLY when no tree exists (a SKIP that the code itself states is
 * not product-complete), and `p6-verified` only means the emitted tree's own
 * tests went green. A tree can satisfy all of those and still have no web
 * entry, no router, no pages, no styled layout and no working ordering flow.
 * This reading surfaces exactly that.
 *
 * WHAT THIS IS NOT. It is not a gate, it never flips an existing field, and it
 * never lowers a bar. The `quality` boolean is true only when every measurable
 * signal below holds; it is a checklist over bytes, not a subjective grade.
 *
 * Client-safe: no `node:` imports, no IO — pure reads over the caller's values,
 * so `doctor.ts` (client-safe) can import it.
 */
import {
  classifyModuleSource,
  gateEvidenceOfProject,
  productSurfaceTrace,
  type GateEvidenceReading,
  type ProductSurfaceKind,
  type ProductSurfaceTrace,
} from "./dod.ts";

/** The minimal file shape this module reads: a repo-relative path and, when the
 *  caller has the bytes, its source. A missing source is reported as unknown,
 *  never treated as real. */
export type QualityTreeFile = { path: string; source?: string };

export type WebEntryReading = {
  /** True when a web HTML entry AND a src entry both exist. */
  present: boolean;
  /** The HTML entry path found (basename `index.html`), or null. */
  html: string | null;
  /** The src entry path found, or null. */
  entry: string | null;
  detail: string;
};

export type PagesReading = {
  /** True when a router API marker sits in a file REACHABLE from the emitted
   *  entry (fixes/354 A2-F9) — string presence, never an execution. */
  routerPresent: boolean;
  /** The router markers that fired, with the file that carried them. */
  routerEvidence: string[];
  /** The measured strength of the router signal: a real router API marker
   *  ("router"), a reachable inline hash-navigation shell ("inline-nav"), or
   *  nothing ("none"). Never an execution. */
  routerStrength: "router" | "inline-nav" | "none";
  /** Distinct page file paths (pages/routes/views dirs, `page.tsx`, `*.page.tsx`). */
  pageFiles: string[];
  /** Page files whose bytes are the scaffold's explicit "not published by this
   *  build" placeholder (fixes/354 A2-F12) — never counted as a real page. */
  placeholderPages: string[];
  /** pageFiles.length − placeholderPages.length (real, content-bearing pages). */
  distinctPages: number;
  /** Distinct route path literals declared in REACHABLE router-bearing files. */
  routePaths: string[];
};

export type LayoutReading = {
  /** True when styled-layout evidence exists in a file REACHABLE from the
   *  emitted entry (fixes/354 A2-F10). */
  styled: boolean;
  evidence: string[];
  /** The strongest thing actually measured — so a single `className=` is never
   *  read as a designed layout. */
  detail: string;
};

export type OrderingFlowReading = {
  /** True when the brief asks for an ordering/checkout flow. */
  applicable: boolean;
  /** True when an order-named callable DECLARED in a reachable file is
   *  referenced by another reachable tree file (a name reference, not an
   *  execution). */
  flowCallable: boolean;
  /** True when a reachable file has a form element with wired submit handling. */
  formWired: boolean;
  flowEvidence: string[];
  formEvidence: string[];
  /** applicable && flowCallable && formWired — the full measurable flow. */
  present: boolean;
  detail: string;
};

export type ModuleCensus = {
  /** Code modules (js/ts/jsx/tsx/mjs/cjs) in the tree. */
  total: number;
  /** Code modules whose source bytes were supplied (the denominator of the census). */
  examined: number;
  /** Non-stub, non-reexport modules (`classifyModuleSource === "real"`). */
  real: number;
  /** TODO(E-15)/template/blank stubs (excludes reexport-only files). */
  stubs: number;
  /** Reexport-only files (`classifyModuleSource === "reexport"`). */
  reexports: number;
  /** Code modules with no source handed in — cannot be classified, never guessed. */
  unknown: number;
};

export type PhaseArtifactCount = { phase: number; count: number };

/**
 * 2026-10-05 — an ADDITIVE determinism reading (which fields are reproducible
 * from the brief alone, which are not, and the generator source that makes them
 * volatile). It never changes emitted bytes (a sibling owns codegen); it only
 * records the observed sources so "the tree is reproducible from the brief" is a
 * measured claim, not an assumption.
 */
export type DeterminismFinding = {
  /** Dotted field path, e.g. `id`, `createdAt`, `traces[].ranAt`. */
  field: string;
  /** True when the field is reproducible from the brief alone. */
  stable: boolean;
  /** The generator source that makes the field unstable (empty when stable). */
  source: string;
  /** What was observed in these bytes (a count / shape, never a guess). */
  detail: string;
  /** Occurrences observed (e.g. log rows), when countable. */
  count?: number;
};

export type DeterminismReading = {
  /** True when no volatile field was observed. */
  deterministic: boolean;
  /** Fields whose value is NOT reproducible from the brief alone. */
  volatile: DeterminismFinding[];
  /** Fields checked and found reproducible. */
  stable: DeterminismFinding[];
  /** Known volatile carriers present with an unclassifiable shape — never guessed. */
  unknown: DeterminismFinding[];
  /** Emitted files inspected beyond the record itself. */
  filesChecked: string[];
  /** One sentence per volatile source. */
  reasons: string[];
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_Z_RE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/;
const UUID_ANYWHERE_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/**
 * Read the determinism of a project record (and, optionally, emitted files).
 * Pure and total: absent keys are simply not reported; a foreign shape is
 * reported `unknown`, never assumed stable. `deterministic` is true only when
 * no volatile carrier was observed in the bytes handed in.
 */
export function determinismReading(
  project: unknown,
  opts?: { emittedFiles?: readonly QualityTreeFile[] },
): DeterminismReading {
  const p = isRecord(project) ? project : null;
  const volatile: DeterminismFinding[] = [];
  const stable: DeterminismFinding[] = [];
  const unknown: DeterminismFinding[] = [];
  const filesChecked: string[] = [];
  const id = p && typeof p.id === "string" ? p.id : null;

  // 1. id — the project identity. A UUID v4 is minted by crypto.randomUUID().
  if (p && "id" in p) {
    const v = p.id;
    if (typeof v !== "string") {
      unknown.push({ field: "id", stable: false, source: "", detail: "id present but not a string" });
    } else if (UUID_RE.test(v)) {
      volatile.push({
        field: "id",
        stable: false,
        source: "crypto.randomUUID() (project mint)",
        detail: `UUID v4 ${v} — a fresh mint per run, and it is embedded in the emitted package.json (rapidtool.packetId / generatedBy) and README.md`,
      });
    } else if (v.trim() !== "") {
      stable.push({ field: "id", stable: true, source: "", detail: `non-random id "${v}"` });
    } else {
      unknown.push({ field: "id", stable: false, source: "", detail: "id is blank" });
    }
  }

  // 2. createdAt — wall-clock epoch ms; reaches README 'Created:' + project.json.
  if (p && "createdAt" in p) {
    const v = p.createdAt;
    if (typeof v === "number" && Number.isFinite(v)) {
      volatile.push({
        field: "createdAt",
        stable: false,
        source: "Date.now() (wall clock)",
        detail: `epoch ${v} — rendered into emitted .rapidtool/project.json and README.md ('Created:')`,
      });
    } else {
      unknown.push({ field: "createdAt", stable: false, source: "", detail: "createdAt present but not a finite number" });
    }
  }

  // 3. traces[].ranAt — one wall-clock stamp per trace row.
  if (p && Array.isArray(p.traces)) {
    const rows = p.traces.filter(isRecord);
    const stamped = rows.filter((r) => typeof r.ranAt === "number" && Number.isFinite(r.ranAt));
    if (stamped.length > 0) {
      volatile.push({
        field: "traces[].ranAt",
        stable: false,
        source: "Date.now() (per trace)",
        detail: `${stamped.length} of ${rows.length} trace row(s) carry a wall-clock ranAt`,
        count: stamped.length,
      });
    }
  }

  // 4. logs[].ts — one wall-clock stamp per log row; fnv1a over timestamped rows
  //    makes any hash that folds them unstable too.
  if (p && Array.isArray(p.logs)) {
    const rows = p.logs.filter(isRecord);
    const stamped = rows.filter((l) => typeof l.ts === "number" && Number.isFinite(l.ts));
    if (stamped.length > 0) {
      volatile.push({
        field: "logs[].ts",
        stable: false,
        source: "Date.now() (per log row)",
        detail: `${stamped.length} of ${rows.length} log row(s) carry a wall-clock ts`,
        count: stamped.length,
      });
    }
  }

  // 5. lastTest.evidenceHash — fnv1a(finalSource + evidence + caseCommitment);
  //    the folded evidence rows carry timestamps, so the hash is not brief-stable.
  const lastTest = p && isRecord(p.lastTest) ? p.lastTest : null;
  if (lastTest && typeof lastTest.evidenceHash === "string" && lastTest.evidenceHash.length > 0) {
    volatile.push({
      field: "lastTest.evidenceHash",
      stable: false,
      source: "fnv1a(finalSource + verify evidence + caseCommitment)",
      detail: "the folded verify rows carry timestamps, so the evidence hash is not reproducible from the brief",
    });
  }

  // 6. treeRun.verdictHash — a hash over the executed tree-run rows.
  const treeRun = p && isRecord(p.treeRun) ? p.treeRun : null;
  if (treeRun && typeof treeRun.verdictHash === "string" && treeRun.verdictHash.length > 0) {
    volatile.push({
      field: "treeRun.verdictHash",
      stable: false,
      source: "tree-run verdict hash over executed rows",
      detail: "carried from a run whose rows are timestamped",
    });
  }

  // 7. generatedTree[].hash — fnv1a(source): content-addressed, so STABLE as long
  //    as the source bytes are. Reported so the reader can see the distinction.
  if (p && Array.isArray(p.generatedTree)) {
    const rows = p.generatedTree.filter(isRecord);
    const hashed = rows.filter((r) => typeof r.hash === "string" && r.hash.length > 0);
    if (hashed.length > 0) {
      stable.push({
        field: "generatedTree[].hash",
        stable: true,
        source: "",
        detail: `${hashed.length} file hash(es) = fnv1a(source): content-addressed, stable iff the source bytes are`,
        count: hashed.length,
      });
    }
  }

  // 8. Emitted files, when the caller has their bytes (a sibling owns writing
  //    them, so this only reads). package.json / README.md embed the UUID id and
  //    a wall-clock stamp — the two carriers that make the emitted tree
  //    non-reproducible from the brief alone.
  for (const f of opts?.emittedFiles ?? []) {
    const path = typeof f.path === "string" ? f.path.replace(/\\/g, "/") : "";
    const src = typeof f.source === "string" ? f.source : "";
    if (path === "" || src === "") continue;
    const base = path.slice(path.lastIndexOf("/") + 1);
    if (base === "package.json") {
      filesChecked.push(path);
      const embedsId = id !== null && id !== "" && src.includes(id);
      const hasUuid = UUID_ANYWHERE_RE.test(src);
      if (embedsId || hasUuid) {
        volatile.push({
          field: `${path}: rapidtool.packetId/generatedBy`,
          stable: false,
          source: "embedded project UUID (crypto.randomUUID())",
          detail: "the emitted package.json names the run's random project id",
        });
      } else {
        stable.push({ field: `${path}: manifest`, stable: true, source: "", detail: "no UUID embedded" });
      }
    } else if (base === "README.md") {
      filesChecked.push(path);
      const iso = ISO_Z_RE.exec(src);
      const embedsId = id !== null && id !== "" && src.includes(id);
      if (iso || embedsId) {
        volatile.push({
          field: `${path}: header`,
          stable: false,
          source: iso ? "createdAt (Date.now()) rendered as ISO" : "embedded project UUID",
          detail: iso ? `ISO timestamp ${iso[0]} in the README header` : "the README names the run's random project id",
        });
      } else {
        stable.push({ field: `${path}: header`, stable: true, source: "", detail: "no timestamp/UUID in the header" });
      }
    }
  }

  const reasons = volatile.map((f) => `${f.field} is not brief-reproducible — ${f.source}`);
  return { deterministic: volatile.length === 0, volatile, stable, unknown, filesChecked, reasons };
}

export type QualityFlags = {
  /** The tree carries zero files. */
  emptyTree: boolean;
  /** The tree carries files but zero real (non-stub, non-reexport) modules. */
  placeholderOnlyTree: boolean;
  /** `--no-empty-tree` holds: the tree is not empty. */
  noEmptyTree: boolean;
  /** `--no-placeholder-only-tree` holds: the tree is not placeholder-only. */
  noPlaceholderOnlyTree: boolean;
};

/** The CLI flag names this reading's two verdicts back, so a caller can gate on
 *  them without re-deriving the condition. */
export const QUALITY_CLI_FLAGS = {
  noEmptyTree: "--no-empty-tree",
  noPlaceholderOnlyTree: "--no-placeholder-only-tree",
} as const;

export type ProductQuality = {
  tree: { present: boolean; fileCount: number; files: string[] };
  webEntry: WebEntryReading;
  pages: PagesReading;
  layout: LayoutReading;
  orderingFlow: OrderingFlowReading;
  modules: ModuleCensus;
  /**
   * ADDITIVE (2026-10-06): the job-scoped census — the SAME file scope as
   * compile-check's `treeSubstanceOf` (`src/jobs/*` + `jobs/*`), read through
   * the SAME `classifyModuleSource`. When this disagrees with `modules`, the
   * disagreement is scoped and named, never two contradictory whole-tree
   * verdicts for the same bytes.
   */
  jobModules: ModuleCensus;
  /**
   * ADDITIVE (2026-10-06): which surface the brief's KIND demands (web page +
   * nav / game input+loop+canvas / runnable non-stub entry) and whether the
   * emitted bytes carry it. Structural byte read — never an execution.
   */
  kindSurface: ProductSurfaceTrace;
  /**
   * ADDITIVE (2026-10-06): the gate-evidence qualification over the record's
   * COMPLETE phases — the SAME `dod.gateEvidenceOfProject` reader doctor and
   * acceptance call, so this surface can never state a different qualification
   * for the same bytes. A quiet `quality:true` reading therefore cannot be read
   * as "the gates ran something" when every green gate rested on non-executed
   * evidence; `gateEvidence.note` carries `RT_E_CLAIM_UNVERIFIED` then.
   */
  gateEvidence: GateEvidenceReading;
  artifacts: {
    /** False when the input was an emitted file list with no project record. */
    known: boolean;
    total: number;
    byPhase: PhaseArtifactCount[];
    emptyPhases: number[];
  };
  flags: QualityFlags;
  /**
   * 2026-10-05 — the ADDITIVE determinism reading: which fields are
   * reproducible from the brief alone, which are not, and their sources. It
   * does not affect `quality` or any other field; it measures a separate claim.
   */
  determinism: DeterminismReading;
  /** Every measurable product signal holds. A checklist over bytes. */
  quality: boolean;
  /** One sentence per absent signal. Empty iff `quality` is true. */
  reasons: string[];
};

/** A web src entry, in priority order — the same list `acceptance-run.mjs`
 *  checks, so the two readings cannot drift on what a "web entry" is. */
export const WEB_SRC_ENTRIES = [
  "src/main.tsx",
  "src/main.ts",
  "src/main.jsx",
  "src/index.tsx",
  "src/index.ts",
  "src/app.tsx",
  "src/App.tsx",
] as const;

const CODE_MODULE_RE = /\.(?:m?[jt]sx?|cjs)$/i;
const STYLE_FILE_RE = /\.(?:css|scss|sass|less|styl)$/i;
const PAGE_DIR_RE = /(?:^|\/)(?:pages?|routes?|views?|screens?)(?:\/|$)/i;
const NEXT_PAGE_RE = /(?:^|\/)app\/.+\/page\.(?:tsx?|jsx?)$/i;
const PAGE_FILE_RE = /(?:^|\/)(?:page\.(?:tsx?|jsx?)|[^/]+\.page\.(?:tsx?|jsx?))$/i;
const ROUTE_TREE_GEN_RE = /routeTree\.gen\.[jt]sx?$/i;

/** Router markers — each fires only on bytes that name a real router API. */
const ROUTER_MARKERS: ReadonlyArray<readonly [string, RegExp]> = [
  ["@tanstack/react-router", /@tanstack\/react-router/],
  ["react-router", /from\s+['"]react-router/],
  ["createBrowserRouter", /createBrowserRouter/],
  ["createFileRoute", /createFileRoute/],
  ["RouterProvider", /<RouterProvider/],
  ["Routes/Route", /<Routes[\s>]|<Route[\s>]/],
  ["useRoutes", /useRoutes\s*\(/],
  ["next/navigation", /next\/navigation|next\/router/],
  ["vue-router", /vue-router/],
];

/** Styled-layout markers. A style file path also fires (see `layoutReading`). */
const STYLE_MARKERS: ReadonlyArray<readonly [string, RegExp]> = [
  ["className", /className\s*=/],
  ["tailwind", /tailwind|@apply\b|@tailwind\b/],
  ["styled-components/emotion", /styled\.|styled\(|css`/],
  ["StyleSheet.create", /StyleSheet\.create/],
  ["style element/attribute", /<style[\s>]|style=\{/],
  ["css import", /import\s+['"][^'"]+\.(?:css|scss|less|styl)['"]/],
];

const FORM_EL_RE = /<form[\s>]|<input[\s>]|<select[\s>]|<textarea[\s>]/;
const FORM_WIRE_RE =
  /onSubmit|handleSubmit|addEventListener\(\s*['"]submit['"]|type\s*=\s*['"]submit['"]|@submit\b/;

/** Declared callables — `function name(...)` and `const name = (...) =>` /
 *  `= function` / `= async (...) =>`. Covers both `export function` and the
 *  `export { name }` clause form the bakeries in the corpus actually emit. */
const FUNCTION_DECL_RE = /\bfunction\s+([A-Za-z_$][\w$]*)/g;
const CALLABLE_CONST_RE =
  /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\(|function\b|[A-Za-z_$][\w$]*\s*=>)/g;
const ORDER_NAME_RE = /order|cart|checkout|basket|menu|purchase|booking|reserve/i;
const ORDER_BRIEF_RE =
  /\border(?:s|ing|ed)?\b|\bcheckout\b|\bcart\b|\bbasket\b|\bpurchase\b|\bmenu\b|\bbooking\b|\breserv(?:e|ation)s?\b/i;

const PHASE_IDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Normalize a tree entry: a non-object or a blank path is dropped, never guessed. */
function toTreeFile(v: unknown): QualityTreeFile | null {
  const r = asRecord(v);
  if (!r) return null;
  const path = typeof r.path === "string" ? r.path.replace(/\\/g, "/").trim() : "";
  if (path === "") return null;
  return { path, ...(typeof r.source === "string" ? { source: r.source } : {}) };
}

function dedupeFiles(files: readonly QualityTreeFile[]): QualityTreeFile[] {
  const seen = new Map<string, QualityTreeFile>();
  for (const f of files) if (!seen.has(f.path)) seen.set(f.path, f);
  return [...seen.values()];
}

function basename(path: string): string {
  const i = path.lastIndexOf("/");
  return i >= 0 ? path.slice(i + 1) : path;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Strip comments so an identifier named in a comment is never a hit. */
function stripComments(source: string): string {
  return String(source ?? "")
    .replace(/\/\*[\s\S]*?\*\//g, "\n")
    .replace(/\/\/[^\n]*/g, "");
}

// ---------------------------------------------------------------------------
// Per-property readings
// ---------------------------------------------------------------------------

/**
 * fixes/354 A2-F12: the emitted placeholder page's own sentence (scaffold's
 * `EmptySection`, `src/ui/view.tsx:4597`) and the component that renders it. A
 * page file carrying either is a not-published placeholder, not a content page.
 */
export const NOT_PUBLISHED_MARKER = "is not published by this build";
const EMPTY_SECTION_RE = /\bEmptySection\b/;
/** Inline hash navigation — a real nav that is not a router API. */
const INLINE_NAV_RE = /hashchange|location\.hash|\bhref\s*=\s*["'`]#\//;

/** Every module specifier a source file imports/exports/requires/`@import`s. */
function importSpecifiers(source: string): string[] {
  const code = stripComments(source);
  const out: string[] = [];
  const push = (re: RegExp): void => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) out.push(m[1]);
  };
  push(/\bfrom\s*['"]([^'"]+)['"]/g);
  push(/\bimport\s*['"]([^'"]+)['"]/g);
  push(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
  push(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
  push(/@import\s+(?:url\(\s*)?['"]([^'"]+)['"]/g);
  return out;
}

/** POSIX path normalization (`.` / `..`); no fs. */
function normalizePosix(p: string): string {
  const parts: string[] = [];
  for (const seg of p.replace(/\\/g, "/").split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      parts.pop();
      continue;
    }
    parts.push(seg);
  }
  return parts.join("/");
}

const RESOLVE_EXTS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".css"] as const;

/** Resolve a relative import specifier against the file set, or null. */
function resolveImport(fromPath: string, spec: string, byPath: ReadonlySet<string>): string | null {
  if (!spec.startsWith(".")) return null;
  const base = fromPath.slice(0, fromPath.lastIndexOf("/") + 1);
  const joined = normalizePosix(base + spec);
  if (byPath.has(joined)) return joined;
  for (const ext of RESOLVE_EXTS) if (byPath.has(joined + ext)) return joined + ext;
  for (const ext of RESOLVE_EXTS) if (byPath.has(`${joined}/index${ext}`)) return `${joined}/index${ext}`;
  return null;
}

/**
 * Every file REACHABLE from the emitted entry by following relative imports
 * (fixes/354 A2-F9/F10). Pure: bytes in, path set out; a file with no source is
 * a leaf. Package specifiers never resolve to a tree file.
 */
export function reachableFiles(
  files: readonly QualityTreeFile[],
  roots: readonly string[],
): Set<string> {
  const byPath = new Set(files.map((f) => f.path));
  const sourceByPath = new Map<string, string>();
  for (const f of files) if (typeof f.source === "string" && f.source !== "") sourceByPath.set(f.path, f.source);
  const seen = new Set<string>();
  const queue = roots.filter((r) => byPath.has(r));
  while (queue.length > 0) {
    const path = queue.pop()!;
    if (seen.has(path)) continue;
    seen.add(path);
    const src = sourceByPath.get(path);
    if (src === undefined) continue;
    for (const spec of importSpecifiers(src)) {
      const resolved = resolveImport(path, spec, byPath);
      if (resolved !== null && !seen.has(resolved)) queue.push(resolved);
    }
  }
  return seen;
}

/** The entry roots to follow: the web src entry + any `index.html` module script. */
function entryRoots(files: readonly QualityTreeFile[], webEntry: WebEntryReading): string[] {
  const roots: string[] = [];
  if (webEntry.entry !== null) roots.push(webEntry.entry);
  const html = files.find((f) => basename(f.path) === "index.html");
  if (html && typeof html.source === "string") {
    const re = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html.source)) !== null) {
      const raw = m[1].replace(/^\.?\//, "").replace(/[?#].*$/, "");
      if (raw !== "") roots.push(raw.replace(/\\/g, "/"));
    }
  }
  return [...new Set(roots)];
}

/** Is a file reachable? Without an explicit set, every file counts (no filter). */
type Reachable = (path: string) => boolean;
function reachablePredicate(paths: ReadonlySet<string> | undefined): Reachable {
  return paths === undefined ? () => true : (p) => paths.has(p);
}

export function webEntryReading(files: readonly QualityTreeFile[]): WebEntryReading {
  const byPath = new Set(files.map((f) => f.path));
  const html = files.find((f) => basename(f.path) === "index.html")?.path ?? null;
  const entry = WEB_SRC_ENTRIES.find((p) => byPath.has(p)) ?? null;
  const present = html !== null && entry !== null;
  return {
    present,
    html,
    entry,
    detail: present
      ? `web entry present: ${html} + ${entry}`
      : html === null
        ? "index.html missing — no web HTML entry (the emit path adds one only for webapp/game kinds)"
        : `no src entry (looked for ${WEB_SRC_ENTRIES.join(", ")})`,
  };
}

export function pagesReading(
  files: readonly QualityTreeFile[],
  opts: { reachable?: ReadonlySet<string> } = {},
): PagesReading {
  const isReachable = reachablePredicate(opts.reachable);
  const pageFiles = files
    .filter(
      (f) =>
        !ROUTE_TREE_GEN_RE.test(f.path) &&
        (PAGE_DIR_RE.test(f.path) || NEXT_PAGE_RE.test(f.path) || PAGE_FILE_RE.test(f.path)),
    )
    .map((f) => f.path);
  // fixes/354 A2-F12: a placeholder page is NOT a page. Unknown bytes (no
  // source) are never guessed as a placeholder.
  const placeholderPages = files
    .filter((f) => pageFiles.includes(f.path) && typeof f.source === "string" && f.source !== "")
    .filter((f) => {
      const code = stripComments(f.source as string);
      return (f.source as string).includes(NOT_PUBLISHED_MARKER) || EMPTY_SECTION_RE.test(code);
    })
    .map((f) => f.path);
  const routerEvidence: string[] = [];
  const routePaths = new Set<string>();
  let inlineNav = false;
  for (const f of files) {
    if (!isReachable(f.path)) continue;
    const src = typeof f.source === "string" ? f.source : "";
    if (src === "") continue;
    const code = stripComments(src);
    for (const [label, re] of ROUTER_MARKERS) {
      if (re.test(code)) routerEvidence.push(`${label} (${f.path})`);
    }
    if (ROUTER_MARKERS.some(([, re]) => re.test(code))) {
      const pathRe = /path\s*[:=]\s*(['"`])([^'"`]+)\1/g;
      let m: RegExpExecArray | null;
      while ((m = pathRe.exec(code)) !== null) routePaths.add(m[2]);
    }
    if (INLINE_NAV_RE.test(code)) inlineNav = true;
  }
  const routerPresent = routerEvidence.length > 0;
  const placeholderSet = new Set(placeholderPages);
  return {
    routerPresent,
    routerEvidence,
    routerStrength: routerPresent ? "router" : inlineNav ? "inline-nav" : "none",
    pageFiles,
    placeholderPages,
    distinctPages: pageFiles.filter((p) => !placeholderSet.has(p)).length,
    routePaths: [...routePaths],
  };
}

export function layoutReading(
  files: readonly QualityTreeFile[],
  opts: { reachable?: ReadonlySet<string> } = {},
): LayoutReading {
  const isReachable = reachablePredicate(opts.reachable);
  const evidence: string[] = [];
  for (const f of files) {
    if (!isReachable(f.path)) continue;
    if (STYLE_FILE_RE.test(f.path)) evidence.push(`${f.path} (style file)`);
    const src = typeof f.source === "string" ? f.source : "";
    if (src === "") continue;
    const code = stripComments(src);
    for (const [label, re] of STYLE_MARKERS) {
      if (re.test(code)) evidence.push(`${label} (${f.path})`);
    }
  }
  const styled = evidence.length > 0;
  return {
    styled,
    evidence,
    detail: styled
      ? `layout evidence is a STATIC byte read (${evidence[0]}) — it is not proof the layout renders`
      : "no styled-layout evidence in any file reachable from the emitted entry",
  };
}

export function orderFlowReading(
  files: readonly QualityTreeFile[],
  brief: string,
  opts: { reachable?: ReadonlySet<string> } = {},
): OrderingFlowReading {
  const applicable = ORDER_BRIEF_RE.test(brief);
  const isReachable = reachablePredicate(opts.reachable);
  // Order-named callables DECLARED in a reachable file, and whether another
  // reachable file references them. Declaration is read from the callable syntax
  // (function / const-arrow), so an `export { createOrder }` clause is still seen.
  const flowEvidence: string[] = [];
  const formEvidence: string[] = [];
  const reachable = files.filter((f) => isReachable(f.path));
  for (const f of reachable) {
    const src = typeof f.source === "string" ? f.source : "";
    if (src === "") continue;
    const code = stripComments(src);
    const names = new Set<string>();
    for (const re of [FUNCTION_DECL_RE, CALLABLE_CONST_RE]) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(code)) !== null) if (ORDER_NAME_RE.test(m[1])) names.add(m[1]);
    }
    for (const name of names) {
      const callers = reachable
        .filter((o) => o.path !== f.path && typeof o.source === "string" && o.source !== "")
        .filter((o) => new RegExp(`\\b${escapeRe(name)}\\b`).test(stripComments(o.source as string)))
        .map((o) => o.path);
      if (callers.length > 0) {
        flowEvidence.push(`${f.path}: ${name} referenced by ${callers.join(", ")}`);
      }
    }
  }

  for (const f of reachable) {
    const src = typeof f.source === "string" ? f.source : "";
    if (src === "") continue;
    const code = stripComments(src);
    if (FORM_EL_RE.test(code) && FORM_WIRE_RE.test(code)) {
      formEvidence.push(`${f.path} (form + submit wiring)`);
    }
  }

  const flowCallable = flowEvidence.length > 0;
  const formWired = formEvidence.length > 0;
  const present = applicable && flowCallable && formWired;
  const missing: string[] = [];
  if (!flowCallable) missing.push("no order-named callable referenced by another REACHABLE tree file");
  if (!formWired) missing.push("no REACHABLE file with a form element + wired submit handler");
  return {
    applicable,
    flowCallable,
    formWired,
    flowEvidence,
    formEvidence,
    present,
    detail: !applicable
      ? "brief does not demand an ordering/checkout flow — not scored"
      : present
        ? "a reachable order-named callable is referenced and a reachable submit-wired form exists — a NAME reference + a byte pattern, never an execution"
        : `ordering flow incomplete: ${missing.join("; ")}`,
  };
}

export function moduleCensus(files: readonly QualityTreeFile[]): ModuleCensus {
  const code = files.filter((f) => CODE_MODULE_RE.test(f.path));
  let real = 0;
  let stubs = 0;
  let reexports = 0;
  let examined = 0;
  for (const f of code) {
    if (typeof f.source !== "string") continue;
    examined += 1;
    // ONE classifier for every census on every surface (dod.classifyModuleSource):
    // product-quality's whole-tree census and compile-check's job-dir `substance`
    // reader can never return two contradictory verdicts for the same bytes.
    const cls = classifyModuleSource(f.source);
    if (cls === "reexport") reexports += 1;
    else if (cls === "stub") stubs += 1;
    else real += 1;
  }
  return { total: code.length, examined, real, stubs, reexports, unknown: code.length - examined };
}

/**
 * The JOB-dir census — the SAME file scope compile-check's `treeSubstanceOf`
 * reads (`src/jobs/*` + `jobs/*`, top-level .ts/.js/.mjs). Exposed so the two
 * readers' agreement is testable on identical bytes, and so a whole-tree
 * `real` count can never contradict a job-scoped `stub-skeleton` silently.
 */
const JOB_MODULE_PATH_RE = /(?:^|\/)(?:src\/jobs|jobs)\/[^/]+\.(?:ts|js|mjs)$/i;

export function jobModuleCensus(files: readonly QualityTreeFile[]): ModuleCensus {
  return moduleCensus(files.filter((f) => JOB_MODULE_PATH_RE.test(f.path.replace(/\\/g, "/"))));
}

export function phaseArtifactCounts(project: unknown): {
  known: boolean;
  total: number;
  byPhase: PhaseArtifactCount[];
  emptyPhases: number[];
} {
  const p = asRecord(project);
  if (!p || !Array.isArray(p.artifacts)) {
    return { known: false, total: 0, byPhase: [], emptyPhases: [] };
  }
  const counts = new Map<number, number>();
  for (const a of p.artifacts) {
    const r = asRecord(a);
    const phase = typeof r?.phase === "number" ? r.phase : Number(r?.phase);
    if (!Number.isFinite(phase)) continue;
    counts.set(phase, (counts.get(phase) ?? 0) + 1);
  }
  const byPhase = PHASE_IDS.map((phase) => ({ phase, count: counts.get(phase) ?? 0 }));
  // 353 (D1 pipeline debug): `emptyPhases` must be STATUS-AWARE. Counting bytes
  // alone called a phase "empty" when it had simply never been entered (a run
  // parked at P6 reports P7–P12 `locked`), which reads as "the stage produced
  // nothing" — a different claim from "the stage never ran". A sealed run whose
  // COMPLETE phase has no artifact is the real emptiness this reports.
  const phases = Array.isArray(p.phases) ? p.phases : [];
  const statusOf = new Map<number, string>();
  for (const rec of phases) {
    const r = asRecord(rec);
    if (typeof r?.id === "number" && typeof r.status === "string") statusOf.set(r.id, r.status);
  }
  return {
    known: true,
    total: p.artifacts.length,
    byPhase,
    emptyPhases: byPhase
      .filter((r) => r.count === 0 && statusOf.get(r.phase) === "complete")
      .map((r) => r.phase),
  };
}

// ---------------------------------------------------------------------------
// The reading
// ---------------------------------------------------------------------------

function qualityFlagsOf(tree: { fileCount: number }, modules: ModuleCensus): QualityFlags {
  const emptyTree = tree.fileCount === 0;
  const placeholderOnlyTree =
    tree.fileCount > 0 && modules.total > 0 && modules.examined === modules.total && modules.real === 0;
  return {
    emptyTree,
    placeholderOnlyTree,
    noEmptyTree: !emptyTree,
    noPlaceholderOnlyTree: !placeholderOnlyTree,
  };
}

/**
 * Build the reading from a project record (and/or an explicit emitted file
 * list). Pure and total: a non-object input yields the all-absent reading with
 * a reason, never a fabricated pass. `generatedTree` and `opts.emittedFiles`
 * are unioned by path so a caller can score a record together with the files
 * its emit actually wrote.
 */
export function readProductQuality(
  project: unknown,
  opts?: { emittedFiles?: readonly QualityTreeFile[] },
): ProductQuality {
  const p = asRecord(project);
  const generated = Array.isArray(p?.generatedTree)
    ? p!.generatedTree.map(toTreeFile).filter((f): f is QualityTreeFile => f !== null)
    : [];
  const emitted = (opts?.emittedFiles ?? [])
    .map(toTreeFile)
    .filter((f): f is QualityTreeFile => f !== null);
  const files = dedupeFiles([...generated, ...emitted]);
  const brief = typeof p?.brief === "string" ? p.brief : "";

  const tree = { present: files.length > 0, fileCount: files.length, files: files.map((f) => f.path) };
  const webEntry = webEntryReading(files);
  // fixes/354 A2-F9/F10: reachability from the emitted entry is the bound every
  // UI signal is measured against — a router/className/form in a file nothing
  // mounts is not part of the product. No entry ⇒ nothing is reachable (the
  // signal is honestly absent, never assumed present).
  const reachable = reachableFiles(files, entryRoots(files, webEntry));
  const pages = pagesReading(files, { reachable });
  const layout = layoutReading(files, { reachable });
  const orderingFlow = orderFlowReading(files, brief, { reachable });
  const modules = moduleCensus(files);
  const jobModules = jobModuleCensus(files);
  const artifacts = phaseArtifactCounts(project);
  // ADDITIVE: the gate-evidence qualification — the SAME reader acceptance and
  // doctor call (dod.gateEvidenceOfProject), so a green gate's evidence class is
  // actionable on this surface too. Pure; never changes `quality`.
  const gateEvidence = gateEvidenceOfProject(project);
  // ADDITIVE: the kind-aware surface trace over the record's own emitted bytes
  // UNIONED with the caller's emitted file list (the scaffold's page/router and
  // game-canvas files are emitted, not generatedTree rows — reading the record
  // alone made this trace disagree with the byte census above and with the DoD
  // surface criteria). A non-object input yields the honest "none/N/A" trace
  // (fail-closed), never a fabricated pass. It never changes `quality`.
  const kindSurface: ProductSurfaceTrace = p
    ? productSurfaceTrace(
        p as unknown as Parameters<typeof productSurfaceTrace>[0],
        opts?.emittedFiles ?? [],
      )
    : productSurfaceTrace({ brief: "", generatedTree: [] } as unknown as Parameters<typeof productSurfaceTrace>[0]);
  const flags = qualityFlagsOf(tree, modules);
  // Additive: a separate reading over the same record (never affects `quality`).
  const determinism = determinismReading(project, { emittedFiles: opts?.emittedFiles });

  const reasons: string[] = [];
  if (files.length === 0) reasons.push("no generated tree — nothing was emitted to inspect");
  else if (modules.real === 0) reasons.push("placeholder-only tree — 0 real (non-stub, non-reexport) modules");
  if (!webEntry.present) reasons.push(`no web entry — ${webEntry.detail}`);
  if (!pages.routerPresent)
    reasons.push(
      pages.routerStrength === "inline-nav"
        ? `no router API reachable from the emitted entry — an inline hash-navigation shell exists, but it is not a router (string-presence read, not an execution)`
        : `no router API reachable from the emitted entry — nothing mounts a route between pages (string-presence read, not an execution; checked ${reachable.size} reachable file(s))`,
    );
  if (pages.distinctPages === 0)
    reasons.push(
      pages.placeholderPages.length > 0
        ? `0 content pages — ${pages.placeholderPages.length} page file(s) are "not published by this build" placeholders (fixes/354 A2-F12)`
        : "0 distinct page files",
    );
  if (!layout.styled)
    reasons.push(
      "no styled layout reachable from the emitted entry (no CSS/Tailwind/className evidence in a reachable file)",
    );
  if (orderingFlow.applicable && !orderingFlow.present) reasons.push(orderingFlow.detail);

  return {
    tree,
    webEntry,
    pages,
    layout,
    orderingFlow,
    modules,
    jobModules,
    kindSurface,
    gateEvidence,
    artifacts,
    flags,
    determinism,
    quality: reasons.length === 0,
    reasons,
  };
}

export type { ProductSurfaceKind, ProductSurfaceTrace } from "./dod.ts";

/** The CLI-flag violations this reading would trip, by their flag name. */
export function qualityFlagViolations(q: ProductQuality): string[] {
  const out: string[] = [];
  if (!q.flags.noEmptyTree) out.push(QUALITY_CLI_FLAGS.noEmptyTree);
  if (!q.flags.noPlaceholderOnlyTree) out.push(QUALITY_CLI_FLAGS.noPlaceholderOnlyTree);
  return out;
}

/** One compact per-project row for the fleet aggregate (bounded, no full tree). */
export type FleetQualityRow = {
  brief: string;
  treePresent: boolean;
  fileCount: number;
  emptyTree: boolean;
  placeholderOnlyTree: boolean;
  distinctPages: number;
  realModules: number;
  /** ADDITIVE: the kind-surface contract the brief demands + whether it holds. */
  surfaceKind: ProductSurfaceKind;
  surfaceOk: boolean;
  quality: boolean;
};

export type FleetProductQuality = {
  /** Project rows presented. */
  projects: number;
  /** Rows whose tree is present. */
  withTree: number;
  emptyTree: number;
  placeholderOnly: number;
  /** Rows whose measurable signals all hold. */
  quality: number;
  /** ADDITIVE: rows whose brief demands a surface (kind !== "none") it lacks. */
  surfaceMissing: number;
  readings: FleetQualityRow[];
};

function briefOfRecord(record: unknown, fallback: string): string {
  const r = asRecord(record);
  if (!r) return fallback;
  for (const v of [r.id, r.name, r.brief]) {
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return fallback;
}

/** Aggregate the product-quality reading over persisted project records (pure).
 *  A non-array input is zeroed — never a fabricated row. */
export function fleetProductQualityFromProjects(projects: readonly unknown[]): FleetProductQuality {
  const rows = Array.isArray(projects) ? projects : [];
  const readings: FleetQualityRow[] = rows.map((p, i) => {
    const q = readProductQuality(p);
    const ks = q.kindSurface;
    const surfaceOk =
      ks.kind === "none"
        ? true
        : ks.kind === "web"
          ? ks.pageFiles.length > 0 && ks.navPath
          : ks.kind === "game"
            ? ks.inputPresent && ks.loopPresent && ks.canvasPresent
            : !ks.entry.stub && ks.entry.missingDeclared.length === 0;
    return {
      brief: briefOfRecord(p, `brief-${i + 1}`),
      treePresent: q.tree.present,
      fileCount: q.tree.fileCount,
      emptyTree: q.flags.emptyTree,
      placeholderOnlyTree: q.flags.placeholderOnlyTree,
      distinctPages: q.pages.distinctPages,
      realModules: q.modules.real,
      surfaceKind: ks.kind,
      surfaceOk,
      quality: q.quality,
    };
  });
  return {
    projects: rows.length,
    withTree: readings.filter((r) => r.treePresent).length,
    emptyTree: readings.filter((r) => r.emptyTree).length,
    placeholderOnly: readings.filter((r) => r.placeholderOnlyTree).length,
    quality: readings.filter((r) => r.quality).length,
    surfaceMissing: readings.filter((r) => r.surfaceKind !== "none" && !r.surfaceOk).length,
    readings,
  };
}
