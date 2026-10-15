#!/usr/bin/env node
// bin/a-command-line-tool-that.mjs — package bin launcher, emitted by the RapidTool scaffold
// (fixes/277 R3-f06). Delegates to the TypeScript entry (../src/main.ts) with
// the same flags the package scripts use (Node >= 22 type stripping — see
// engines.node). argv passes straight through; the entry's structured stub
// refuses with RT_E_VALIDATION only when the CLI is actually run.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const entry = fileURLToPath(new URL("../src/main.ts", import.meta.url));
const run = spawnSync(process.execPath, ["--experimental-strip-types", entry, ...process.argv.slice(2)], {
  stdio: "inherit",
});
process.exit(run.status === null ? 1 : run.status);
