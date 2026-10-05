// ---------------------------------------------------------------------------
// write-set.ts — 174-F8 SSSF-style write-set rollback library (fixes/196 + 207).
//
// Snapshot listed relative paths under a root, apply writes that RECORD the
// prior bytes first, then roll the set back (restore prior bytes, or unlink
// files that did not exist). Pure-ish Node fs. NOT a sandbox: no denylist,
// no command interception, no isolation — just byte-level undo for a known
// path list. Emit wiring (O_EXCL flock + tree-run) is parent/headless.
//
// Residual harden (207): refuse path escape (`..` / absolute); batch apply
// with automatic rollback on throw so emit consumers cannot leave a partial
// tree when one write fails mid-set.
// ---------------------------------------------------------------------------
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, normalize, sep } from "node:path";
// R11-f07: ONE shared physical-containment helper (scripts/path-safety.mjs —
// same cross-boundary pattern as db.ts → migration-plan.mjs). Lexical checks
// cannot see symlinks; this resolves both sides on the real filesystem.
import { physicalInside } from "../../scripts/path-safety.mjs";
import type { ErrorCode } from "./errors.ts";

/** Prior state of one relative path under the write-set root. */
export type PathSnapshot = {
  existed: boolean;
  bytes: string | null;
};

/** Map of repo-relative path → prior state. Keys are the relPaths as given. */
export type WriteSnapshot = Map<string, PathSnapshot>;

/**
 * Refuse absolute paths and any `..` segment so apply/rollback cannot escape
 * the write-set root. Forward/back slashes both checked after normalize.
 */
export function assertSafeRelPath(rel: string): string {
  if (typeof rel !== "string" || rel.length === 0) {
    const err = new Error("write-set: relative path required") as Error & { code?: ErrorCode };
    err.code = "RT_E_VALIDATION";
    throw err;
  }
  if (rel.includes("\0")) {
    const err = new Error("write-set: path contains null byte") as Error & { code?: ErrorCode };
    err.code = "RT_E_VALIDATION";
    throw err;
  }
  const unified = rel.replace(/\\/g, "/");
  if (isAbsolute(rel) || isAbsolute(unified) || /^[a-zA-Z]:\//.test(unified) || unified.startsWith("/")) {
    const err = new Error(`write-set: absolute path refused: ${rel}`) as Error & { code?: ErrorCode };
    err.code = "RT_E_VALIDATION";
    throw err;
  }
  const norm = normalize(unified);
  const parts = norm.split(/[/\\]/).filter((p) => p.length > 0 && p !== ".");
  if (parts.some((p) => p === "..")) {
    const err = new Error(`write-set: path escape refused: ${rel}`) as Error & { code?: ErrorCode };
    err.code = "RT_E_VALIDATION";
    throw err;
  }
  // Re-join with platform sep for join(root, …) stability, keep logical rel key as given.
  return parts.join(sep);
}

function absOf(root: string, rel: string): string {
  assertSafeRelPath(rel);
  const abs = join(root, rel);
  // Defense in depth: resolved abs must stay under root (handles odd normalize).
  const rootNorm = normalize(root.endsWith(sep) || root.endsWith("/") ? root : root + sep);
  const absNorm = normalize(abs);
  const rootCmp = rootNorm.replace(/\\/g, "/").toLowerCase();
  // 337-3: this used to be `(absNorm + (absNorm.endsWith(sep) ? "" : ""))` — a
  // ternary with identical branches (dead expression, called out by both
  // watchdogs). The prefix check below is already separator-safe, so the plain
  // normalized value is the whole rule.
  const absCmp = absNorm.replace(/\\/g, "/").toLowerCase();
  const rootPrefix = rootCmp.endsWith("/") ? rootCmp : rootCmp + "/";
  if (absCmp !== rootCmp.replace(/\/$/, "") && !absCmp.startsWith(rootPrefix)) {
    const err = new Error(`write-set: path escaped root: ${rel}`) as Error & { code?: ErrorCode };
    err.code = "RT_E_VALIDATION";
    throw err;
  }
  // R11-f07 (S-05): the lexical checks above cannot see a symlinked parent or
  // a junctioned subtree — a path that LOOKS inside can physically land
  // outside. Verify with the shared physical helper: confirmed-outside throws;
  // `null` (nothing along the prefix resolves — e.g. a root that does not
  // exist yet) keeps the lexical verdict, which is the pre-R11-f07 law.
  if (physicalInside(root, abs) === false) {
    // Wrong-KIND path entity: the lexical rel looked inside but the resolved
    // filesystem entry (symlink/junction) is a different kind than claimed.
    const err = new Error(
      `write-set: path physically escaped root (symlink/junction): ${rel}`,
    ) as Error & { code?: ErrorCode };
    err.code = "RT_E_PATH_KIND_MISMATCH";
    throw err;
  }
  return abs;
}

function readRecord(abs: string): PathSnapshot {
  try {
    const bytes = readFileSync(abs, "utf8");
    return { existed: true, bytes };
  } catch {
    return { existed: false, bytes: null };
  }
}

/**
 * Snapshot the listed relative paths under `root`. Missing files (and a
 * missing root) record `{ existed: false, bytes: null }` — never throws for
 * absence. Unsafe rel paths throw (do not silently skip — emit must know).
 */
export function snapshotPaths(root: string, relPaths: readonly string[]): WriteSnapshot {
  const out: WriteSnapshot = new Map();
  for (const rel of relPaths) {
    out.set(rel, readRecord(absOf(root, rel)));
  }
  return out;
}

/**
 * Restore every recorded path: rewrite prior bytes when the file existed,
 * otherwise unlink it (ENOENT is ignored). Missing root does not throw.
 * Rollback walks entries in reverse insertion order so later overlays undo first.
 */
export function rollback(root: string, snapshot: ReadonlyMap<string, PathSnapshot>): void {
  const entries = [...snapshot.entries()].reverse();
  for (const [rel, rec] of entries) {
    let abs: string;
    try {
      abs = absOf(root, rel);
    } catch {
      continue; // skip unsafe keys that should never have been recorded
    }
    if (rec.existed) {
      try {
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, rec.bytes ?? "", "utf8");
      } catch {
        // missing root / unwritable: never throw — caller grades the tree.
      }
    } else {
      try {
        unlinkSync(abs);
      } catch {
        // ENOENT / missing root: already absent.
      }
    }
  }
}

/**
 * Record the prior bytes of `rel` into `snapshot` (first write wins — a
 * later applyWrite of the same path keeps the original record) then write
 * `body`. Returns the same Map instance. Creates parent directories.
 * Throws on path escape (no write). Write IO errors propagate (caller rolls back).
 */
export function applyWrite(
  root: string,
  rel: string,
  body: string,
  snapshot: WriteSnapshot = new Map(),
): WriteSnapshot {
  const abs = absOf(root, rel);
  if (!snapshot.has(rel)) {
    snapshot.set(rel, readRecord(abs));
  }
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body, "utf8");
  return snapshot;
}

/**
 * Batch apply for emit-style multi-file writes. Snapshots every path first
 * (first-write-wins against an existing snapshot), then writes in order.
 * On any throw: rollback the full snapshot and rethrow — partial trees do
 * not survive a mid-set failure.
 */
export function applyWrites(
  root: string,
  files: readonly { path: string; body: string }[],
  snapshot: WriteSnapshot = new Map(),
): WriteSnapshot {
  for (const f of files) {
    if (!snapshot.has(f.path)) {
      snapshot.set(f.path, readRecord(absOf(root, f.path)));
    }
  }
  try {
    for (const f of files) {
      const abs = absOf(root, f.path);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, f.body, "utf8");
    }
  } catch (err) {
    rollback(root, snapshot);
    throw err;
  }
  return snapshot;
}
