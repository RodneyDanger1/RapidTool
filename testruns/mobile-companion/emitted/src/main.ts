// ---------------------------------------------------------------------------
// src/main.ts — Library entry — the module package main/exports point at
// machine-generated from RapidTool packet f13debeb-b530-445b-9f52-85b82ad7839e; regenerate, don't hand-edit.
// Importable: importing runs nothing. `entry` is real; the implementation
// surface lands behind the structured refusal below.
// ---------------------------------------------------------------------------

import { pathToFileURL } from "node:url";

export type LibraryInfo = { name: string; version: string };

/** Package identity — REAL values off the emitted package.json contract. */
export const entry: LibraryInfo = { name: "crumb-bloom", version: "0.0.0" };

/** TODO(R3-f06) at this line: the oracle rows name the functions this module
 *  must export — add them here; the refusal stands until they are real. */
export async function main(): Promise<number> {
  throw new Error("RT_E_VALIDATION · TODO(E-15) stub: implement the library surface per the oracle (R3-f06)");
}

// Direct-execution guard (the standard ESM main-module check): main runs ONLY
// when this file is the program being executed — any import (tests, tooling,
// the oracle spec) never triggers it, which is what makes the stub importable.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
