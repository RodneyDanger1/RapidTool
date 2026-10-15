// ---------------------------------------------------------------------------
// preview-compile.server.ts — server-only transpiler for the preview iframe.
//
// The emitted webapp UI is TSX; a browser cannot load it directly. This module
// uses the TypeScript compiler (already a runtime dependency of the server —
// compile-check.server.ts imports it) to transpile the emitted code files to
// CommonJS. It COMPILES ONLY — it never evaluates the generated code; the
// browser evaluates the returned modules with its own React so the generated
// code runs in the user's page, exactly as it would after a download.
//
// Import ONLY via ./preview-compile.ts's createServerFn (dynamic import), never
// from client code directly.
// ---------------------------------------------------------------------------

import ts from "typescript";

export type CompiledModule = { path: string; code: string };

export type PreviewCompileResult =
  | { ok: true; modules: CompiledModule[]; diagnostics: number }
  | { ok: false; error: string };

const CODE_EXT_RE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/i;

/**
 * Transpile every code file in the emitted tree to CommonJS (React 17+
 * automatic JSX runtime). `.css`/`.json`/docs pass through untouched and are
 * excluded here. Syntax problems surface as `diagnostics` but never throw —
 * the browser render falls back honestly if the emitted module will not run.
 */
export function compileEmittedModules(
  files: readonly { path: string; body: string }[],
): PreviewCompileResult {
  const modules: CompiledModule[] = [];
  let diagnostics = 0;
  for (const file of files) {
    if (!CODE_EXT_RE.test(file.path)) continue;
    try {
      const out = ts.transpileModule(file.body, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
          allowJs: true,
          sourceMap: false,
          isolatedModules: true,
        },
        fileName: file.path,
        reportDiagnostics: true,
      });
      diagnostics += out.diagnostics?.length ?? 0;
      modules.push({ path: file.path, code: out.outputText });
    } catch (err) {
      return {
        ok: false,
        error: `failed to transpile ${file.path}: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
  return { ok: true, modules, diagnostics };
}
