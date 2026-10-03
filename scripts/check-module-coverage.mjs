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
 * a decision record, not a blanket exemption. The guard also FAILS on a
 * *stale* entry (a module now reached by a test), so the allowlist can only
 * shrink by adding a real test, never linger as a silent exemption.
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
 * W50 · 336-6 correction: every entry below now states the HONEST reason it is
 * here, and the three kinds are distinguishable:
 *   · HARNESS-BLOCKED — the module is live but the node test harness physically
 *     cannot load it (`.tsx` JSX, `import.meta.env`; the extensionless-relative-
 *     import and TS-parameter-property classes were cleared in W51 · 337-2, so
 *     they no longer appear here). Each reason names the exact blocker,
 *     verified by importing the module under `node --experimental-strip-types`.
 *   · NO CONSUMER — nothing in the repo imports the module (dead code, proposed
 *     for removal; never deleted here because dead-code removal is the owner's
 *     call).
 *   · NO BEHAVIOUR — importable pure data whose only test would freeze a value.
 *
 * An entry says why the module has no test today, never that having no test is
 * fine. A NEW uncovered module (absent here) still fails the guard; these
 * entries pin the gap R9-f05 recorded so the guard is a ratchet, not a blanket
 * exemption. Entries may only be REMOVED by adding a real test.
 */
export const COVERAGE_ALLOWLIST = {
  // --- R9-f05 T5.2-A honesty surface: CLOSED by W46 · 332-5 (and by W50 · 336-6
  // for db.ts / gate-session-marker.ts / providers.ts / preview.ts, whose real
  // tests now reach them, so their entries are deleted — a regression that
  // orphans them again FAILS this guard instead of falling back to an exemption).
  // --- auth surface: live; mixed classes. client.ts / use-current-user.ts read
  //     `import.meta.env` (still harness-blocked); the five W51 · 337-2 entries
  //     below are NOW node-loadable but have no driveable behaviour in the
  //     harness — their old blocker text was true until W51 and is corrected.
  "src/lib/auth/client.ts":
    "LIVE browser auth entry (imported by auth/gates.tsx, auth/use-current-user.ts, auth/middleware.ts). Harness-blocked: reads `import.meta.env.VITE_AUTH_ENABLED` at module load — a Vite-only transform; under plain Node the import throws `Cannot read properties of undefined (reading 'VITE_AUTH_ENABLED')`.",
  "src/lib/auth/gate-session.server.ts":
    "LIVE Better Auth gate-session plugin (imported by auth/server.ts:40). NOW NODE-LOADABLE — W51 · 337-2 added the missing `.ts` to its two relative imports; verified by importing it under `node --experimental-strip-types` (exit 0). No test drives it: exercising `gateIdentitySessions()` needs a live Better Auth `/get-session` request context the node harness does not provide.",
  "src/lib/auth/pglite-dialect.ts":
    "LIVE Kysely dialect over PGlite (imported by auth/server.ts:42). NOW NODE-LOADABLE — W51 · 337-2 replaced its constructor parameter properties with explicit field assignments; verified by import under `node --experimental-strip-types` (exit 0). No test drives it: a behavioural test needs a PGlite instance, and db.ts's PGlite branch calls Vite's `import.meta.glob` (absent under plain Node).",
  "src/lib/auth/popup.server.ts":
    "LIVE `/auth/popup` handler (loaded by the Vite `authPopupPlugin`, vite.config.ts:112 `ssrLoadModule`). NOW NODE-LOADABLE — W51 · 337-2 fixed the transitive `auth/server.ts` `./preview` specifier; verified by import under `node --experimental-strip-types` (exit 0). No test drives it: `handleAuthPopupRequest` calls `auth.api.signInWithOAuth2` (a live Better Auth backend + network).",
  "src/lib/auth/server.ts":
    "LIVE app Better Auth instance (reached at runtime via popup.server.ts / verify.server.ts). NOW NODE-LOADABLE — W51 · 337-2 added `.ts` to the `\"./preview\"`/`\"./providers\"` specifiers and removed pglite-dialect's parameter properties; verified by import under `node --experimental-strip-types` (exit 0). No test drives it: asserting `betterAuth({…})` behaviour needs a live database + broker.",
  "src/lib/auth/use-current-user.ts":
    "LIVE client session hook (imported by auth/gates.tsx:6). Harness-blocked: imports auth/client.ts, which reads `import.meta.env` at load (Vite-only).",
  "src/lib/auth/verify.server.ts":
    "LIVE server-side session resolver (imported by auth/middleware.ts:42). NOW NODE-LOADABLE — W51 · 337-2 fixed the transitive `auth/server.ts` `./preview` specifier; verified by import under `node --experimental-strip-types` (exit 0). No test drives it: `getSessionUser`/`requireUserId` need the TanStack Start request context (`getRequest()`), absent in the node harness.",
  // --- auth surface: `.tsx` (JSX is outside the node runner) ---
  "src/lib/auth/provider.tsx":
    "LIVE app-root provider (imported by src/routes/__root.tsx:3). `.tsx`: `node --experimental-strip-types` refuses JSX files (`Unknown file extension \".tsx\"`) and test discovery is `*.test.ts` only.",
  // --- auth surface: importable, but not a useful test target ---
  "src/lib/auth/email-password.ts":
    "LIVE email/password on/off switch (imported by auth/server.ts:39). Pure one-line flag: the only possible test freezes its value, which would fight the documented enable path (`emailAndPasswordEnabled = true`), so it is allowlisted rather than pinned.",
  "src/lib/auth/gates.tsx":
    "NO CONSUMER (precise scan: the only reference is a doc-comment example in auth/use-current-user.ts:49; no real import anywhere) AND `.tsx`, so the node runner cannot load it. Proposed: wire it to a route or remove it.",
  "src/lib/auth/middleware.ts":
    "LIVE-by-contract: `authMiddleware` is THE documented server-function wrapper, but ZERO importers in this repo (its only `import` is its own doc comment at :12). Importable, yet driving its behaviour needs the TanStack Start server runtime; a node test could only assert the export exists. Proposed: wire a real server function to it, or remove.",
  "src/lib/error-component.tsx":
    "LIVE router error/not-found boundary (imported by src/router.tsx:2 and src/routes/__root.tsx:4). `.tsx`: `node --experimental-strip-types` refuses JSX files and test discovery is `*.test.ts` only.",
  // --- the remainder R9-f05 named ---
  "src/lib/app-data/index.ts":
    "NO CONSUMER: a barrel with ZERO importers (precise scan over src/, scripts/, vite.config.ts and every test — the only hit is this allowlist entry). Its re-exported members are already reached directly via app-data.test.ts. Proposed for deletion.",
  "src/lib/multiplayer/index.ts":
    "NO CONSUMER: a barrel with ZERO importers (it only re-exports the dormant multiplayer/p2p.ts). Proposed for deletion.",
  "src/lib/multiplayer/p2p.ts":
    "DORMANT by design (its own HONESTY header): no `/api/rtc` relay ships and no live consumer exists (its only importer is the dead multiplayer/index.ts barrel). Its WebRTC paths need RTCPeerConnection and `import.meta.env`, so no node test can drive them. Proposed: keep only as the relay contract, or remove.",
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

/**
 * Split the gap list into the reviewed allowlist and everything else.
 * @param {string[]} gaps
 * @param {Record<string, string>} [allowlist]
 */
export function partitionGaps(gaps, allowlist = COVERAGE_ALLOWLIST) {
  return {
    allowlisted: gaps.filter((g) => allowlist[g]),
    unallowlisted: gaps.filter((g) => !allowlist[g]),
  };
}

/**
 * Allowlist entries that no longer describe a gap — the module IS reached by a
 * test now. Such an entry is a hole in the ratchet: it would silently re-exempt
 * the module if a later change orphaned it again. A stale entry fails the guard
 * so it must be deleted (the allowlist may only shrink by adding a real test).
 * @param {string[]} gaps
 * @param {Record<string, string>} [allowlist]
 */
export function staleAllowlistEntries(gaps, allowlist = COVERAGE_ALLOWLIST) {
  const gapSet = new Set(gaps);
  return Object.keys(allowlist)
    .filter((file) => !gapSet.has(file))
    .sort();
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
  const stale = staleAllowlistEntries(gaps);
  if (unreadable.length > 0) {
    // Fail closed: a subtree this walk could not read is not evidence of coverage.
    console.error(`[module-coverage] could not read ${unreadable.length} path(s): ${unreadable.join(", ")}`);
    process.exit(2);
  }
  if (json) {
    console.log(JSON.stringify({ total, covered, gaps, allowlisted, unallowlisted, stale }, null, 2));
  } else {
    for (const g of gaps) {
      const reason = COVERAGE_ALLOWLIST[g];
      console.log(
        reason
          ? `${g}: [module-coverage] allowlisted — ${reason}`
          : `${g}: [module-coverage] no test reaches this module — add a test or an allowlist entry with a reason`,
      );
    }
    for (const g of stale) {
      console.log(
        `${g}: [module-coverage] STALE allowlist entry — this module is reached by a test now; delete the entry`,
      );
    }
    console.log(
      `[module-coverage] ${covered}/${total} src/lib modules reached by a test · ${allowlisted.length} allowlisted · ${unallowlisted.length} unallowlisted gap(s) · ${stale.length} stale allowlist entr${stale.length === 1 ? "y" : "ies"}`,
    );
  }
  process.exit(unallowlisted.length === 0 && stale.length === 0 ? 0 : 1);
}

if (isMainModule(import.meta.url)) {
  main(process.argv.slice(2));
}
