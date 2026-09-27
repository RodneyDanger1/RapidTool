// scripts/path-safety.mjs — ONE shared physical-containment helper (W29 §R11-f07).
//
// Lexical prefix checks (resolve/normalize + startsWith) cannot see symlinks,
// junctions, 8.3 short names, or case folding: a path that LOOKS inside a root
// can physically land outside it. This helper realpaths as far as each path
// exists on disk (resolving every symlink in the existing prefix), re-appends
// the not-yet-existing remainder lexically, and compares the two REAL paths.
//
// Consumers (one implementation, three call sites — never three copies):
//   - src/lib/write-set.ts      (the emit write-set: refuses an escaped abs path)
//   - scripts/write-atomic.mjs  (refuses a staged file physically under public/)
//   - scripts/rapidtool-cli.mjs (the `edit` verb: refuses a symlinked escape of --dir)
//
// Honesty contract for callers: `physicalInside` returns null when it cannot
// verify (an unresolvable prefix) — null must NEVER be silently treated as
// "inside"; each caller chooses its own fail-open/fail-closed for null and
// documents it at the call site.
import { realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";

/**
 * Resolve `p` to its physical path: realpath the deepest EXISTING ancestor
 * (resolving symlinks/junctions/case there), then re-append the missing
 * suffix lexically (nothing exists there yet, so there is nothing to resolve).
 * Returns null only when no ancestor is resolvable — the filesystem root
 * itself cannot be realpath'd (practically untestable).
 * @param {string} p
 * @returns {string | null}
 */
export function physicalPath(p) {
  let cur = resolve(p);
  /** @type {string[]} */
  const suffix = [];
  for (;;) {
    try {
      const real = realpathSync(cur);
      return suffix.length === 0 ? real : join(real, ...suffix);
    } catch {
      const parent = dirname(cur);
      if (parent === cur) return null;
      suffix.unshift(basename(cur));
      cur = parent;
    }
  }
}

/**
 * Physical containment: is `target` strictly inside `rootDir` on the real
 * filesystem?
 *   true  = confirmed inside (both sides resolved up to the deepest existing
 *           ancestor; a symlinked parent/child cannot hide here).
 *   false = confirmed outside.
 *   null  = unverifiable (a prefix that does not resolve at all).
 * The root itself never counts (strict containment, same law as the lexical
 * checks this replaces).
 * @param {string} rootDir
 * @param {string} target
 * @returns {boolean | null}
 */
export function physicalInside(rootDir, target) {
  const root = physicalPath(rootDir);
  const tgt = physicalPath(target);
  if (root === null || tgt === null) return null;
  const rel = relative(root, tgt);
  if (rel === "") return false; // strict containment: the root itself never counts
  return !relativeEscapes(rel);
}

/**
 * Does a `relative()` result denote a path OUTSIDE its base? True for a bare
 * `..`, a `..`-prefixed SEGMENT (win32 sep-aware — relative() is
 * platform-shaped, so the separator is derived, never guessed), or an
 * absolute result (a different drive on win32). `""` (the base itself) is
 * NOT an escape — strict containment is each caller's own extra condition.
 * `..foo` is a legal sibling name and stays INSIDE: the naive
 * `rel.startsWith("..")` overreach read it as an escape (refused a legal
 * path; write-atomic.mjs and run-eval.mjs carried copies of that form).
 * @param {string} rel
 * @returns {boolean}
 */
export function relativeEscapes(rel) {
  return rel === ".." || rel.startsWith(`..${sepOf(rel)}`) || isAbsolute(rel);
}

/**
 * The separator `relative()` used for `rel` — node hands back platform-shaped
 * output, so derive it instead of guessing (win32 "\\", POSIX "/").
 * @param {string} rel
 * @returns {string}
 */
function sepOf(rel) {
  return rel.includes("\\") ? "\\" : "/";
}
