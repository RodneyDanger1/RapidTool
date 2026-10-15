// ---------------------------------------------------------------------------
// preview-compile.ts — client-facing contract for the preview transpiler.
//
// Mirrors ./chat.ts: a TanStack server function wraps the server-only
// `preview-compile.server.ts`, so no client bundle ever imports the TypeScript
// compiler. Every failure is an honest typed result the preview component can
// render, never a thrown transport error.
// ---------------------------------------------------------------------------

import { createServerFn } from "@tanstack/react-start";
import type { CompiledModule, PreviewCompileResult } from "./preview-compile.server.ts";

export type { CompiledModule, PreviewCompileResult };

export type PreviewSourceFile = { path: string; body: string };

const compileServer = createServerFn({ method: "POST" })
  .validator((input: { files: PreviewSourceFile[] }) => input)
  .handler(async ({ data }): Promise<PreviewCompileResult> => {
    const { compileEmittedModules } = await import("./preview-compile.server.ts");
    return compileEmittedModules(data.files);
  });

/** Transpile the emitted code files, returning an honest typed result. */
export async function compilePreviewModules(
  files: PreviewSourceFile[],
): Promise<PreviewCompileResult> {
  try {
    return await compileServer({ data: { files } });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
