// ---------------------------------------------------------------------------
// software-export.ts — the browser-side emit seam.
//
// `scaffold.scaffoldProject` is PURE (Project JSON -> ScaffoldFile[]): it never
// touches `node:fs`, so the console can turn a project that lives only in
// browser storage into the exact file tree the CLI would write, then hand the
// user a real ZIP. This module owns that bridge: emit, choose the entry
// document, assemble a self-contained preview document, and pack the tree.
//
// It is DOM-free (bytes + strings only) so it is unit-testable under Node; the
// components do the Blob/anchor work.
// ---------------------------------------------------------------------------

import type { ErrorCode } from "./errors.ts";
import { slugName } from "./io.ts";
import {
  projectKindOf,
  scaffoldProject,
  surfaceTreeRows,
  type ProjectKind,
  type ScaffoldFile,
  type SurfaceTreeRow,
} from "./scaffold.ts";
import type { Project } from "./types.ts";
import { createZip } from "./zip.ts";

/** Extensions the preview compiler turns into loadable modules. */
const CODE_EXT_RE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/i;

export type EmittedSoftware =
  | {
      ok: true;
      kind: ProjectKind;
      files: ScaffoldFile[];
      summary: string;
      warnings: string[];
      /** The emitted webapp UI module (`src/ui/...`), or null when none exists. */
      uiPath: string | null;
      /** The HTML entry document (`index.html`) when the kind has one. */
      entryPath: string | null;
      /**
       * fixes/347-2: the emitted SURFACE modules (pages/router for a web tree,
       * the game module, the runnable entry) in `Project.generatedTree` row
       * shape — the wiring dod's kind-aware gates read. Fold these into the
       * project the gate judges: `surfaceTreeRows(project, emitted.files)`.
       */
      surfaceTree: SurfaceTreeRow[];
      /**
       * 347 / fixes/354 A2-F4 · B2-F5: present when the project's own trail
       * recorded a WITHHELD reason — a below-floor `RT_E_PLAN_UNDERPRODUCED`
       * partial (landed under this seam's explicit banner opt-in, with the
       * caution banner in the README), an uncleared red tree-run, or a partial
       * synthesis. The tree is surfaced for inspection with an unmissable
       * banner; a refused plan is never silently presented as a cleared build.
       */
      redTree?: { code: ErrorCode; detail: string };
    }
  | { ok: false; error: string; code?: ErrorCode };

export type SoftwareArchive =
  | { ok: true; bytes: Uint8Array; filename: string; fileCount: number }
  | { ok: false; error: string; code?: ErrorCode };

/** The unmissable banner prepended to an admitted red tree's README. */
export function redTreeBannerText(detail: string): string {
  return [
    "> [!CAUTION]",
    "> **RED TREE — surfaced below the build's own completion bar.**",
    "> The guided build recorded a below-floor P6 verdict for this project:",
    `> \`${String(detail).replace(/\s+/g, " ").slice(0, 400)}\``,
    "> These are the files the run actually produced. They have NOT cleared the",
    "> brief-faithfulness gate, so treat this as a work-in-progress preview.",
    "",
  ].join("\n");
}

const RT_E_PREFIX_RE = /^(RT_E_[A-Z0-9_]+)/;

/** The last recorded P6 synthesis refusal's own code + detail (never invented). */
function lastSynthesisRefusal(project: Project): { code: ErrorCode; detail: string } | null {
  const rows = Array.isArray(project.logs) ? project.logs : [];
  let found: { code: ErrorCode; detail: string } | null = null;
  for (const row of rows) {
    if (row.event !== "p6.synthesis.refused") continue;
    const detail = typeof row.detail === "string" ? row.detail : "";
    const m = RT_E_PREFIX_RE.exec(detail);
    if (m) found = { code: m[1] as ErrorCode, detail };
  }
  return found;
}

/** Emit the project's product tree. Pure; mirrors the CLI emit result shape. */
export function emitSoftware(project: Project): EmittedSoftware {
  let result: ReturnType<typeof scaffoldProject>;
  try {
    // fixes/357: this seam is the INSPECTION surface, so it opts in EXPLICITLY
    // to the banner policy. fixes/356 restored `refuse` as the safety default,
    // which made the console Preview dead-end on the coded
    // `RT_E_PLAN_UNDERPRODUCED` refusal for a below-floor run instead of
    // showing the tree it did produce. The opt-in covers that ONE policy and
    // nothing else: every other emission refusal (an invented figure literal,
    // an unloadable CommonJS body, an invalid project) is still returned
    // unchanged, and the scaffold refuses such a plan for a direct caller.
    result = scaffoldProject(project, { underProduced: "partial" });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  if (!result.ok) return { ok: false, error: result.error, code: result.code };
  // fixes/354 A2-F4 (D1): under that opt-in the scaffold LANDS the bannered
  // below-floor partial (the `> [!CAUTION]` / `## BELOW-FLOOR PLAN` banner is
  // at the top of its README) and reports the withheld reason on the result.
  // Carry EVERY withheld reason into `redTree` (B2-F5) so the Preview marks any
  // refused plan — never a normal, unmarked, downloadable product.
  let redTree: { code: ErrorCode; detail: string } | undefined;
  if (result.underProduced) {
    redTree = { code: result.underProduced.code, detail: result.underProduced.detail };
  } else if (result.redTree) {
    redTree = {
      code: "RT_E_TREE_RUN_FAILED",
      detail:
        "the project's tree-run trail is RED — an uncleared p6.tree.failure with no green run since. " +
        "These files are a record of a failed tree-run, not a verified build.",
    };
  } else if (result.partial) {
    const refusal = lastSynthesisRefusal(project);
    redTree = {
      code: refusal?.code ?? "RT_E_VALIDATION",
      detail:
        refusal?.detail ??
        "the last P6 synthesis verdict was a refusal while real generated substance exists (prior chunks kept) — this tree is a PARTIAL, neither the floor nor a full pass.",
    };
  }
  // The below-floor banner is scaffold-owned; add the red-tree banner only for a
  // red trail the scaffold did not already banner, so the README never carries
  // a duplicate caution.
  let files = result.files;
  if (redTree !== undefined && result.underProduced === undefined) {
    const banner = redTreeBannerText(redTree.detail);
    files = files.map((f) => (f.path === "README.md" ? { ...f, body: `${banner}${f.body}` } : f));
  }
  const entry = entryDocumentOf(files);
  return {
    ok: true,
    kind: projectKindOf(project),
    files,
    summary: result.summary,
    warnings: result.warnings ?? [],
    uiPath: result.uiGeneration?.uiPath ?? null,
    entryPath: entry ? entry.path : null,
    surfaceTree: surfaceTreeRows(project, files),
    ...(redTree ? { redTree } : {}),
  };
}

/** The emitted entry document: the Vite `index.html` when the kind ships one. */
export function entryDocumentOf(files: readonly ScaffoldFile[]): ScaffoldFile | null {
  return files.find((f) => f.path === "index.html") ?? null;
}

/** Code files only — the input the preview compiler transpiles. */
export function codeFilesOf(files: readonly ScaffoldFile[]): { path: string; body: string }[] {
  return files.filter((f) => CODE_EXT_RE.test(f.path)).map((f) => ({ path: f.path, body: f.body }));
}

/** `<slug>-software.zip` — the downloaded archive name. */
export function softwareArchiveFilename(project: Project): string {
  const slug = slugName(project.name);
  return `${slug || "rapidtool"}-software.zip`;
}

/**
 * Pack the emitted tree into a STORE-only ZIP. Any refusal from `emitSoftware`
 * (e.g. an invented figure literal, an unloadable CommonJS body) is forwarded
 * unchanged so the caller surfaces the registered code instead of an empty
 * archive. A below-floor run is NOT a refusal here: `emitSoftware` opts in to
 * the banner policy, so its ZIP is offered with the bannered README inside.
 */
export function buildSoftwareArchive(
  project: Project,
  options: { date?: Date } = {},
): SoftwareArchive {
  const emitted = emitSoftware(project);
  if (!emitted.ok) return emitted;
  let bytes: Uint8Array;
  try {
    bytes = createZip(
      emitted.files.map((f) => ({ path: f.path, body: f.body })),
      options.date ? { date: options.date } : {},
    );
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  return {
    ok: true,
    bytes,
    filename: softwareArchiveFilename(project),
    fileCount: emitted.files.length,
  };
}

const MODULE_SCRIPT_RE = /<script\b[^>]*\btype=["']module["'][^>]*>\s*<\/script>/gi;
const SRC_SCRIPT_RE = /<script\b[^>]*\bsrc=[^>]*>\s*<\/script>/gi;
const ROOT_DIV_RE = /<div\s+id=["']root["']\s*>\s*<\/div>/i;

/** Strip the Tailwind v4 `@import` (the plugin is not present in the iframe). */
function cssForPreview(css: string): string {
  return css
    .replace(/^\s*@import\s+["'][^"']+["']\s*;?\s*$/gm, "")
    .replace(/^\s*@import\s+url\([^)]*\)\s*;?\s*$/gm, "");
}

/**
 * Assemble a self-contained preview document from the emitted entry HTML.
 *
 * The emitted `index.html` points its module script at `/src/main.tsx`, which
 * only resolves under Vite — inside the sandboxed preview iframe that fetch
 * would either 404 or pull the host app, so the script tags are removed, the
 * emitted CSS is inlined, and (when the caller rendered the UI) the rendered
 * markup is placed into `#root`.
 *
 * Returns null when the tree has no HTML entry (cli-tool / library / service).
 */
export function previewDocumentFor(
  files: readonly ScaffoldFile[],
  renderedMarkup?: string | null,
): string | null {
  const entry = entryDocumentOf(files);
  if (!entry) return null;
  const css = files
    .filter((f) => /\.css$/i.test(f.path))
    .map((f) => cssForPreview(f.body))
    .join("\n");
  let doc = entry.body.replace(MODULE_SCRIPT_RE, "").replace(SRC_SCRIPT_RE, "");
  if (css.trim().length > 0) {
    const style = `<style>\n${css}\n</style>\n`;
    doc = doc.includes("</head>") ? doc.replace("</head>", `${style}</head>`) : style + doc;
  }
  if (renderedMarkup && renderedMarkup.trim().length > 0) {
    doc = ROOT_DIV_RE.test(doc)
      ? doc.replace(ROOT_DIV_RE, `<div id="root">${renderedMarkup}</div>`)
      : doc.replace("</body>", `<div id="root">${renderedMarkup}</div></body>`);
  }
  return doc;
}

/** Total UTF-8 byte size of the emitted tree (shown in the toolbar). */
export function treeByteSize(files: readonly ScaffoldFile[]): number {
  const encoder = new TextEncoder();
  let total = 0;
  for (const f of files) total += encoder.encode(f.body).length;
  return total;
}
