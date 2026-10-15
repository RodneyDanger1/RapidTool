// ---------------------------------------------------------------------------
// preview-render.ts — render the emitted webapp UI to static HTML, in-browser.
//
// The emitted UI module is React/TSX. `preview-compile.ts` transpiles it to
// CommonJS server-side; this module evaluates those modules with the app's OWN
// React (so nothing extra is downloaded) and renders the component with
// `react-dom/server`. The result is a faithful, static snapshot of the product
// the emitted tree would mount — placed into the sandboxed preview iframe.
//
// Evaluation is scoped to the emitted tree: a `require` shim resolves relative
// specifiers to sibling emitted modules and maps react/react-dom to the host
// React. Unresolvable imports fail honestly (the caller falls back to the raw
// entry document) — no primitive is ever stubbed with fabricated behaviour.
// ---------------------------------------------------------------------------

import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import type { CompiledModule } from "./preview-compile.server.ts";

export type PreviewRenderResult = { ok: true; html: string } | { ok: false; error: string };

const RESOLVE_EXTENSIONS = ["", ".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];

function dirOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i < 0 ? "" : path.slice(0, i);
}

/** Resolve a relative specifier against the emitted tree's own file set. */
function resolveRelative(
  byPath: ReadonlyMap<string, string>,
  fromPath: string,
  spec: string,
): string | null {
  if (!spec.startsWith(".")) return null;
  const base = dirOf(fromPath);
  const segments = (base ? base.split("/") : []).concat(spec.split("/"));
  const stack: string[] = [];
  for (const segment of segments) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") stack.pop();
    else stack.push(segment);
  }
  const joined = stack.join("/");
  for (const ext of RESOLVE_EXTENSIONS) {
    const candidate = `${joined}${ext}`;
    if (byPath.has(candidate)) return candidate;
  }
  // Directory import: try <dir>/index.<ext>.
  for (const ext of RESOLVE_EXTENSIONS.slice(1)) {
    const candidate = `${joined}/index${ext}`;
    if (byPath.has(candidate)) return candidate;
  }
  return null;
}

/**
 * Evaluate the emitted modules and render `entryPath`'s default/`Console`
 * export to static markup. Returns an honest error string on any failure.
 */
export function renderEmittedComponent(
  modules: readonly CompiledModule[],
  entryPath: string,
): PreviewRenderResult {
  const byPath = new Map(modules.map((m) => [m.path, m.code]));
  const cache = new Map<string, unknown>();

  const loadModule = (path: string): Record<string, unknown> => {
    if (cache.has(path)) return cache.get(path) as Record<string, unknown>;
    const code = byPath.get(path);
    if (code === undefined) {
      throw new Error(`emitted module not found: ${path}`);
    }
    const module = { exports: {} as Record<string, unknown> };
    // Seed the cache before evaluation so a cyclic import resolves to the
    // partially-populated exports rather than recursing forever.
    cache.set(path, module.exports);
    const requireShim = (spec: string): unknown => {
      if (spec === "react") return React;
      if (spec === "react/jsx-runtime") return jsxRuntime;
      if (spec === "react-dom/client" || spec === "react-dom") {
        const noopRoot = { render: () => {}, unmount: () => {} };
        return { createRoot: () => noopRoot, default: { createRoot: () => noopRoot } };
      }
      const resolved = resolveRelative(byPath, path, spec);
      if (resolved !== null) return loadModule(resolved);
      throw new Error(`cannot resolve "${spec}" from ${path}`);
    };
    // Evaluating the user's OWN emitted (transpiled) module is the whole point:
    // it is the code they are previewing, running in their own page (never on
    // the server). The `require` shim above bounds its imports to the tree.
    const factory = new Function("require", "module", "exports", code) as (
      require: (spec: string) => unknown,
      module: { exports: Record<string, unknown> },
      exports: Record<string, unknown>,
    ) => void;
    factory(requireShim, module, module.exports);
    return module.exports;
  };

  try {
    const entry = loadModule(entryPath);
    const candidate = entry.default ?? entry.Console;
    if (typeof candidate !== "function") {
      return {
        ok: false,
        error: `emitted UI ${entryPath} exports no React component (looked for default / Console)`,
      };
    }
    const html = renderToStaticMarkup(React.createElement(candidate as () => React.ReactElement));
    return { ok: true, html };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
