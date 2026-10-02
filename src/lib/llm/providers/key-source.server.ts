/**
 * SERVER-SIDE key resolution from a declared `.env` file (W45 · 331-1).
 *
 * WHY THIS EXISTS. `key-resolution.ts` is the pure precedence rule; the CLI
 * installed it for the CLI only. The app's own UI path (Vite dev server →
 * TanStack server function → `crew.server.ts` → provider) never loaded `.env`,
 * so on a machine with a stale User-scope `DEEPSEEK_API_KEY` the console's
 * "Spawn crew" still 401'd on `…42ff`. This module is the ONE fs seam that lets
 * the PROVIDER resolve the `.env` key for ANY server-side entry point:
 *
 *   - an entry point declares the file path once via `RAPIDTOOL_LLM_ENV_FILE`
 *     (`scripts/with-app-env.mjs` for `dev`/`build`/`preview`, the CLI for its
 *     own invocation), then
 *   - `deepseekApiKey()` (and the OpenAI-compatible adapter) read the key
 *     through `resolveProcessKey`, which applies the SAME matrix as the CLI:
 *     `.env` wins over a differing non-blank ambient value (loud + coded
 *     `RT_E_LLM_KEY_SHADOWED`, tail-only), a present-but-blank process value
 *     DISABLES `.env`, absence lets `.env` supply the key.
 *
 * The file path is the only thing crossable between entry point and provider —
 * a PATH, never a secret; the secret never leaves this server-side module and is
 * never `VITE_`-prefixed. With NO marker set the read is byte-identical to the
 * old `process.env` behavior, so unit tests that never declare the file are
 * unaffected.
 *
 * Server-only: imports `node:fs`. Never import from client code.
 */

import { readFileSync } from "node:fs";
import {
  formatShadowWarning,
  parseEnvFile,
  resolveApiKey,
  setActiveKeySource,
  type KeyConflict,
  type KeyResolution,
} from "./key-resolution.ts";

/** Env var naming the `.env` file a server-side entry point wants resolved. */
export const LLM_ENV_FILE_VAR = "RAPIDTOOL_LLM_ENV_FILE";

/** The last shadow line emitted, so a per-call read warns only once. */
let lastShadowWarning: string | null = null;

function emitShadowWarning(name: string, envFilePath: string, conflict: KeyConflict): void {
  const line = formatShadowWarning(name, envFilePath, conflict);
  if (lastShadowWarning === line) return;
  lastShadowWarning = line;
  try {
    process.stderr.write(line + "\n");
  } catch {
    /* stderr unusable — the conflict is still resolved, never silently */
  }
}

/** Read ONE key from the declared file, or null when absent/unreadable. */
function readEnvFileValue(envFilePath: string, name: string): string | null {
  try {
    return parseEnvFile(readFileSync(envFilePath, "utf8"))[name] ?? null;
  } catch {
    return null; // no/unreadable file → the process environment is the only source
  }
}

/**
 * Resolve `name` for the current process: the declared `.env` file (if a caller
 * set `RAPIDTOOL_LLM_ENV_FILE`) over the process environment, under the module's
 * precedence rule. When `.env` wins, its value is INSTALLED into `env` so direct
 * readers (secret redaction, presence probes) agree with the provider, and the
 * provenance is recorded so a 401 can name the source. No marker ⇒ a pure
 * process-environment read (byte-identical legacy behavior).
 */
export function resolveProcessKey(
  name: string,
  env: NodeJS.ProcessEnv = process.env,
): KeyResolution {
  const declared =
    typeof env[LLM_ENV_FILE_VAR] === "string" ? env[LLM_ENV_FILE_VAR].trim() : "";
  const processValue = env[name] ?? null;
  if (!declared) {
    // No declared file: a PURE process read with NO side effects — byte-identical
    // to the legacy behavior and unable to clobber an explicit provenance a
    // caller (or a test) already installed.
    return resolveApiKey({ name, envFileValue: null, envFilePath: "", processValue });
  }
  const envFileValue = readEnvFileValue(declared, name);
  const resolution = resolveApiKey({
    name,
    envFileValue,
    envFilePath: declared,
    processValue,
  });
  if (resolution.effective) {
    if (resolution.effective.kind === "repo-env-file") {
      env[name] = resolution.effective.value;
    }
    setActiveKeySource(resolution.effective);
  } else {
    setActiveKeySource(null);
  }
  if (resolution.conflict) {
    emitShadowWarning(name, declared, resolution.conflict);
  }
  return resolution;
}
