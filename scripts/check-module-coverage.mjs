#!/usr/bin/env node
/**
 * R9-f05 / R9-f06 (W45 · lane 331-6) — module-coverage guard.
 *
 * Every gate in this repo can be green while a `src/lib` module is *never
 * touched by any test*: typecheck, lint, the assertion-gap lint and both test
 * legs all pass on a suite that simply never imports it. R9-f05 found 12 such
 * modules at the audit, including the T5.2-A honesty surface
 * (`fixtures.review.ts` + `fixtures.server.ts`).
 *
 * This guard computes reachability: start from every test file
 * (`src/lib/**\/*.test.ts` and `scripts/**\/*.test.mjs`), follow static
 * imports / re-exports / dynamic `import()` / `require()` through the
 * `src/lib` module graph, and report every module nothing reaches. A module
 * with zero importing test is a failure unless it is on the explicit,
 * reviewed allowlist below — each entry carries a reason, so the allowlist is
 * a decision record, not a blanket exemption.
 *
 * Usage:
 *   node scripts/check-module-coverage.mjs            # text findings, exit 0/1
 *   node scripts/check-module-coverage.mjs --json     # machine-readable
 *
 * Exit codes: 0 = every module reached (or allowlisted) · 1 = gap(s) · 2 = usage.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { isMainModule, projectRoot } from "./with-app-env.mjs";

/**
 * The honest tail shared by every entry whose surface has no owner in the W45
 * lane table: it is RECORDED, not justified. An entry says why the module has
 * no test today, never that having no test is fine.
 */
const UNCOVERED_NO_OWNER =
  "reached by no test; no lane in the W45 table owns this surface — recorded for the next wave (R9-f05), not exempted as correct.";

/**
 * Modules that are deliberately not covered, each with the reason a reviewer
 * needs. A NEW uncovered module (absent here) fails the guard; these entries
 * pin the gap R9-f05 already recorded so the guard is a ratchet, not a
 * blanket exemption. Entries may only be REMOVED by adding a real test.
 */
export const COVERAGE_ALLOWLIST = {
  // --- R9-f05 T5.2-A honesty surface: CLOSED by W46 · 332-5 ---
  // `fixtures.review.ts` + `fixtures.server.ts` are now reached by
  // `src/lib/fixtures.review.test.ts`. Their allowlist entries were removed
  // (the entries may only be removed by adding a real test) so a regression
  // that orphans them again FAILS this guard instead of falling back to a
  // recorded exemption.
  // --- auth surface (14 modules; the R9-f05 "auth/* (8)" has grown) ---
  "src/lib/auth/client.ts": `better-auth client. ${UNCOVERED_NO_OWNER}`,
  "src/lib/auth/email-password.ts": `auth email/password flow. ${UNCOVERED_NO_OWNER}`,
  "src/lib/auth/gate-session-marker.ts": `HITL gate session marker. ${UNCOVERED_NO_OWNER}`,
  "src/lib/auth/gate-session.server.ts": `HITL gate session (server half). ${UNCOVERED_NO_OWNER}`,
  "src/lib/auth/gates.tsx": `auth gate components. ${UNCOVERED_NO_OWNER}`,
  "src/lib/auth/middleware.ts": `auth middleware adapter. ${UNCOVERED_NO_OWNER}`,
  "src/lib/auth/pglite-dialect.ts": `PGlite SQL dialect for better-auth. ${UNCOVERED_NO_OWNER}`,
  "src/lib/auth/popup.server.ts": `auth popup server handler. ${UNCOVERED_NO_OWNER}`,
  "src/lib/auth/preview.ts": `auth preview helper. ${UNCOVERED_NO_OWNER}`,
  "src/lib/auth/provider.tsx": `auth React provider. ${UNCOVERED_NO_OWNER}`,
  "src/lib/auth/providers.ts": `auth provider registry. ${UNCOVERED_NO_OWNER}`,
  "src/lib/auth/server.ts": `auth server config. ${UNCOVERED_NO_OWNER}`,
  "src/lib/auth/use-current-user.ts": `auth client hook. ${UNCOVERED_NO_OWNER}`,
  "src/lib/auth/verify.server.ts": `auth verification (server half). ${UNCOVERED_NO_OWNER}`,
  // --- the remainder R9-f05 named ---
  "src/lib/app-data/index.ts": `server-only app-data barrel. ${UNCOVERED_NO_OWNER}`,
  "src/lib/db.ts": `database connection factory (reached only through the build/migrate path). ${UNCOVERED_NO_OWNER}`,
  "src/lib/error-component.tsx": `React error boundary (no client render harness in the repo). ${UNCOVERED_NO_OWNER}`,
  "src/lib/multiplayer/index.ts": `multiplayer barrel. ${UNCOVERED_NO_OWNER}`,
  "src/lib/multiplayer/p2p.ts": `multiplayer P2P transport. ${UNCOVERED_NO_OWNER}`,
};

const SPEC_RE = /\b(?:from|import|require)\s*\(?\s*["']([^"']+)["']/g;
const TEST_FILE_RE = /\.test\.(?:ts|tsx|mjs|js)$/;
const WALK_SKIP = new Set(["node_modules", ".git", ".vercel", "dist", "build", "coverage", ".output", ".grok"]);

/**
 * Recursively list files under `dir` whose name matches `predicate`. An
 * unreadable directory is pushed onto `unreadable` (fail closed) — a coverage
 * walk that skipped a subtree would report a module as unreached, or missed,
 * on partial evidence.
 */
function walk(dir, predicate, out = [], unreadable = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    if (err?.code !== "ENOENT") unreadable.push(dir);
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".") || WALK_SKIP.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.isSymbolicLink()) continue;
      walk(full, predicate, out, unreadable);
    } else if (predicate(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Every production `src/lib` module (no tests, no declarations). */
export function libModules(root = projectRoot(), unreadable = []) {
  return walk(
    join(root, "src", "lib"),
    (name) => /\.tsx?$/.test(name) && !/\.d\.ts$/.test(name) && !TEST_FILE_RE.test(name),
    [],
    unreadable,
  ).sort();
}

/** Every test file that could import a `src/lib` module. */
export function testFiles(root = projectRoot(), unreadable = []) {
  return [
    ...walk(join(root, "src", "lib"), (name) => TEST_FILE_RE.test(name), [], unreadable),
    ...walk(join(root, "scripts"), (name) => TEST_FILE_RE.test(name), [], unreadable),
  ].sort();
}

/** Import specifiers written in a source file. */
export function importSpecifiers(source) {
  const specs = [];
  SPEC_RE.lastIndex = 0;
  let m;
  while ((m = SPEC_RE.exec(source)) !== null) specs.push(m[1]);
  return specs;
}

/** Resolve a specifier to an existing module file, or `null` (bare packages, misses). */
export function resolveSpecifier(spec, fromFile, root) {
  let base;
  if (spec.startsWith("@/")) base = join(root, "src", spec.slice(2));
  else if (spec.startsWith("./") || spec.startsWith("../")) base = resolve(dirname(fromFile), spec);
  else return null;
  const candidates = [base];
  if (!/\.(?:ts|tsx|mts|cts|js|mjs|cjs)$/.test(base)) {
    candidates.push(`${base}.ts`, `${base}.tsx`, join(base, "index.ts"));
  }
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

/**
 * Modules reachable from the test suite. Breadth-first over the import graph:
 * a module counts as covered when a test reaches it directly OR through another
 * module (a test exercising `engine.ts` exercises `phases.ts`).
 */
export function coveredModules(root = projectRoot()) {
  const unreadable = [];
  const tests = testFiles(root, unreadable);
  const modules = libModules(root, unreadable);
  const moduleSet = new Set(modules);
  const queue = [];
  const seen = new Set();
  const edges = new Map();
  const readEdges = (file) => {
    if (edges.has(file)) return edges.get(file);
    let source = "";
    try {
      source = readFileSync(file, "utf8");
    } catch {
      edges.set(file, []);
      return [];
    }
    const resolved = [];
    for (const spec of importSpecifiers(source)) {
      const hit = resolveSpecifier(spec, file, root);
      if (hit && moduleSet.has(hit)) resolved.push(hit);
    }
    edges.set(file, resolved);
    return resolved;
  };
  for (const test of tests) {
    for (const mod of readEdges(test)) {
      if (!seen.has(mod)) {
        seen.add(mod);
        queue.push(mod);
      }
    }
  }
  while (queue.length) {
    const current = queue.shift();
    for (const next of readEdges(current)) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return { modules, covered: seen, unreadable };
}

/** Modules no test reaches and that the allowlist does not name. */
export function moduleCoverageGaps(root = projectRoot()) {
  const { modules, covered, unreadable } = coveredModules(root);
  const gaps = modules
    .filter((m) => !covered.has(m))
    .map((m) => relative(root, m).replace(/\\/g, "/"));
  return { total: modules.length, covered: covered.size, gaps, unreadable };
}

/** Split the gap list into the reviewed allowlist and everything else. */
export function partitionGaps(gaps, allowlist = COVERAGE_ALLOWLIST) {
  return {
    allowlisted: gaps.filter((g) => allowlist[g]),
    unallowlisted: gaps.filter((g) => !allowlist[g]),
  };
}

function main(argv) {
  const json = argv.includes("--json");
  const extra = argv.filter((a) => !a.startsWith("--"));
  if (extra.length) {
    console.error(`[module-coverage] unexpected argument(s): ${extra.join(", ")}`);
    process.exit(2);
  }
  const root = projectRoot();
  const { total, covered, gaps, unreadable } = moduleCoverageGaps(root);
  const { allowlisted, unallowlisted } = partitionGaps(gaps);
  if (unreadable.length > 0) {
    // Fail closed: a subtree this walk could not read is not evidence of coverage.
    console.error(`[module-coverage] could not read ${unreadable.length} path(s): ${unreadable.join(", ")}`);
    process.exit(2);
  }
  if (json) {
    console.log(JSON.stringify({ total, covered, gaps, allowlisted, unallowlisted }, null, 2));
  } else {
    for (const g of gaps) {
      const reason = COVERAGE_ALLOWLIST[g];
      console.log(
        reason
          ? `${g}: [module-coverage] allowlisted — ${reason}`
          : `${g}: [module-coverage] no test reaches this module — add a test or an allowlist entry with a reason`,
      );
    }
    console.log(
      `[module-coverage] ${covered}/${total} src/lib modules reached by a test · ${allowlisted.length} allowlisted · ${unallowlisted.length} unallowlisted gap(s)`,
    );
  }
  process.exit(unallowlisted.length === 0 ? 0 : 1);
}

if (isMainModule(import.meta.url)) {
  main(process.argv.slice(2));
}
