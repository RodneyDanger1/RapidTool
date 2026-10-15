#!/usr/bin/env node
/**
 * Hand a staged file over to a path another agent reads, in one step.
 *
 *   node scripts/write-atomic.mjs /workspace/.grok/og.jpg.tmp public/og.jpg
 *
 * The brand-asset task writes public/og.jpg and src/lib/og/site.json while the
 * parent may be mid-`npm run build`, so an in-place write can be read
 * half-finished. rename(2) is atomic within one filesystem: a reader sees the
 * old bytes or the new ones. /workspace is one filesystem, so a staged file
 * from anywhere else (/tmp is a separate mount) is refused rather than copied:
 * copying would have to land its temp in the target's directory, which is the
 * one thing a staged path is not allowed to do.
 */
import { existsSync, mkdirSync, renameSync, rmdirSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
// R11-f07: the shared physical-containment helper (one implementation, three
// call sites — see scripts/path-safety.mjs).
import { physicalInside, relativeEscapes } from "./path-safety.mjs";
// W42 L4-G5 (q2 A-99): the shared main-module check (realpath-based — a
// symlinked or case-differing launch path still runs the CLI; the naive
// `pathToFileURL` compare silently no-opped it). See with-app-env.mjs:97-105.
import { isMainModule } from "./with-app-env.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export function parseWriteAtomicArgs(argv) {
  const [staged, target, ...rest] = argv;
  if (!staged || !target) {
    return { error: "usage: node scripts/write-atomic.mjs <staged-file> <target>" };
  }
  if (rest.length > 0) return { error: `unexpected argument: ${rest[0]}` };
  return { staged, target };
}

function isInside(dir, file) {
  const rel = relative(dir, file);
  // K3 payout (W39): the segment-correct escape test (relativeEscapes from
  // path-safety.mjs) replaces the old `!rel.startsWith("..")` overreach that
  // mis-classified legitimate `..foo` names; isAbsolute stays for drive-mismatch.
  return rel !== "" && !relativeEscapes(rel) && !isAbsolute(rel);
}

/**
 * Why a staged path can be refused: `vite build` copies public/ verbatim into
 * the deployed app, so a temp that lands there ships (and an interrupted run
 * leaves it behind).
 */
export function stagingError({ staged, target, publicDir }) {
  if (staged === target) return `staged file and target are the same path: ${target}`;
  // R11-f07 (S-05): also refuse when the PHYSICAL path is under publicDir —
  // a symlinked public/ or staged path can pass the lexical check while the
  // bytes would land inside the shipped directory. `null` (unverifiable)
  // keeps the lexical verdict, never silently "not inside".
  if (isInside(publicDir, staged) || physicalInside(publicDir, staged) === true) {
    return `stage outside ${publicDir} (vite build ships that directory verbatim): ${staged}`;
  }
  return null;
}

/**
 * Moves `staged` onto `target`, leaving `target` untouched if anything fails.
 * `rename` is injectable because EXDEV — the refusal the "stage under
 * /workspace/.grok/" contract rests on — cannot be provoked portably.
 */
export function handOver(staged, target, { rename = renameSync, mkdir = mkdirSync, rmdir = rmdirSync } = {}) {
  if (!existsSync(staged)) {
    throw Object.assign(new Error(`staged file is missing: ${staged}`), { code: "ENOENT" });
  }
  // W42 L4-G3 (q2 A-100): the mkdir sits INSIDE the try with the rename — it
  // is part of the hand-over's single mutation step, so a rename failure
  // re-throws through the one catch below (raw error, or the EXDEV advice)
  // instead of failing across two independent failure paths. W352: a failed
  // rename must also RECLAIM the parent directories this call created — the old
  // path left `src/lib/og/` behind for a target it never wrote.
  const parent = dirname(target);
  const created = [];
  try {
    // Record the exact missing ancestors so cleanup removes only what we made.
    const missing = [];
    for (let cur = parent; cur && !existsSync(cur); ) {
      missing.push(cur);
      const up = dirname(cur);
      if (up === cur) break;
      cur = up;
    }
    for (const dir of missing.reverse()) {
      mkdir(dir);
      created.push(dir);
    }
    rename(staged, target);
  } catch (err) {
    // Remove shallow→deep ordering is reversed: deepest first (created is
    // root-first, so reverse it), and only ever an EMPTY dir we just made.
    for (const dir of [...created].reverse()) {
      try {
        rmdir(dir);
      } catch {
        /* not empty (a concurrent writer landed a file) or already gone */
      }
    }
    if (err?.code === "EXDEV") {
      throw new Error(
        `${staged} is on another filesystem than ${target}, so the hand-over cannot be a `
          + "rename — stage under /workspace/.grok/ instead",
      );
    }
    throw err;
  }
}

if (isMainModule(import.meta.url)) {
  const args = parseWriteAtomicArgs(process.argv.slice(2));
  if (args.error) {
    console.error(`[write-atomic] ${args.error}`);
    process.exit(1);
  }
  // Relative paths follow this script's root, not the caller's cwd: the brand
  // pass runs from wherever its sub-shell left it, and the public/ refusal
  // below is defined against that same root.
  const staged = resolve(ROOT, args.staged);
  const target = resolve(ROOT, args.target);
  const problem = stagingError({ staged, target, publicDir: join(ROOT, "public") });
  if (problem) {
    console.error(`[write-atomic] ${problem}`);
    process.exit(1);
  }
  try {
    handOver(staged, target);
  } catch (err) {
    console.error(`[write-atomic] ${staged} → ${target} failed: ${err?.message || err}`);
    process.exit(1);
  }
  console.log(`[write-atomic] wrote ${target}`);
}
