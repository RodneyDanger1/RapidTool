// ---------------------------------------------------------------------------
// auth-import-contract.test.ts — W51 · lane 337-2 (Pulse)
//
// The auth cluster is the part of the src chain a previous wave found
// unloadable by the pinned node runner (`node --experimental-strip-types`).
// Two STRUCTURAL causes are pinned here as source-level contracts:
//
//  1. Every RELATIVE specifier in `src/lib/auth/**` must carry an explicit
//     CODE extension (AGENTS.md: "Node imports use explicit `.ts` extensions in
//     the src chain (strip-types)"). An extensionless `./preview` /
//     `./gate-identity.server` resolves under Vite but fails plain ESM with
//     `ERR_MODULE_NOT_FOUND` — that blocked auth/server.ts (and,
//     transitively, popup.server.ts and verify.server.ts) plus the live
//     gate-session plugin. Note the `.server`/`.client` NAME segment is not an
//     extension (see CODE_EXT_RE).
//  2. No TS parameter properties in the cluster — strip-only mode rejects them
//     (`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX: TypeScript parameter property is not
//     supported in strip-only mode`), which kept auth/server.ts unloadable via
//     pglite-dialect.ts even after (1) was fixed.
//
// This test READS the bytes; it deliberately imports no auth module, so it
// changes no module-coverage reachability (the coverage guard's allowlist is a
// ratchet — see scripts/check-module-coverage.mjs). The loadability itself is
// proven by the lane's import probe (`%TEMP%\rt337_2\probe-import.mjs`), which
// loads all seven auth/db modules under the pinned runner.
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
/** Every production auth source (tests excluded). */
const sources = readdirSync(here).filter(
  (name) => /\.tsx?$/.test(name) && !name.endsWith(".test.ts"),
);

/** Static/`export … from` and dynamic `import("…")` specifiers. */
const SPECIFIER_RE = /\bfrom\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;

/**
 * A real code/asset extension. Deliberately NOT `\.[A-Za-z0-9]+$`: that
 * accepted `.server` / `.client` NAME segments (the real file is
 * `gate-identity.server.ts`), so an extensionless `./gate-identity.server`
 * slipped through and two of the three offenders this pin exists for were
 * unprotected (Verifier finding, W51). Only a code extension counts.
 */
const CODE_EXT_RE = /\.(?:ts|tsx|mts|cts|mjs|cjs|js|jsx|json)$/;

function relativeSpecifiers(source: string): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(SPECIFIER_RE)) {
    const spec = m[1] ?? m[2];
    if (spec && (spec.startsWith("./") || spec.startsWith("../"))) out.push(spec);
  }
  return out;
}

describe("auth import contract (node strip-types loadability)", () => {
  it("every relative specifier in src/lib/auth/** carries an explicit code extension", () => {
    const offenders: string[] = [];
    for (const name of sources) {
      const src = readFileSync(join(here, name), "utf8");
      for (const spec of relativeSpecifiers(src)) {
        const last = spec.split("/").pop() ?? "";
        if (!CODE_EXT_RE.test(last)) offenders.push(`${name} → ${spec}`);
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `extensionless relative specifiers break the pinned node runner:\n${offenders.join("\n")}`,
    );
  });

  it("no TS parameter properties in src/lib/auth/** (strip-only rejects them)", () => {
    const offenders: string[] = [];
    for (const name of sources) {
      if (name.endsWith(".tsx")) continue;
      const src = readFileSync(join(here, name), "utf8");
      for (const m of src.matchAll(/constructor\s*\(([^)]*)\)/g)) {
        if (/\b(private|public|protected|readonly)\b/.test(m[1])) {
          offenders.push(`${name}: constructor(${m[1].trim()})`);
        }
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `parameter properties are rejected by strip-only mode:\n${offenders.join("\n")}`,
    );
  });
});
