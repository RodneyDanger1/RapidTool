/**
 * R11-f08 (W30 S4 lane) — the forced-emit QUARANTINE-MOVE seam.
 *
 * `emit --force` used to KEEP foreign files in place (`headless.ts`'s
 * `survivors`) — so a later tree-run judged bytes the factory never authored
 * (A1-f07: the minted "tested" tree was a mixed tree). The fix is to move the
 * foreign files ASIDE and report the list: a forced emit never judges foreign
 * bytes again.
 *
 * This module is the move itself: `<dir>/.rapidtool-quarantine/<stamp>/<rel>`
 * per file, mkdir -p, rename with a copy+unlink fallback, failures recorded —
 * NEVER silently dropped, never a delete (quarantine means recoverable).
 *
 * Wiring (this wave): `scripts/rapidtool-cli.mjs`'s `emit` arm calls this
 * AFTER an ok emit that returned `survivors`, and reports `quarantined` +
 * `quarantineDir` on the envelope; when a move FAILS it suppresses the
 * `--verify-kind`/`--check`/`--run` legs (`judgingSkipped`) so a green tree-run
 * can never mint `tested` over a still-mixed tree. TODO(R11-f08): lift the move
 * INTO `emitProject` (headless.ts:1675-1682 refusal / :1722 in-place
 * `survivors`) so EVERY forced caller quarantines, not just the CLI —
 * 'headless.ts is E1b's window this wave; the CLI-side seam is the safe
 * placement' (see fixes/272_s4_floor.md §[2]).
 *
 * Note for the later lift: `walkEmitRel` skips `QUARANTINE_DIR_NAME`
 * (`headless.ts` EMIT_SKIP_DIRS), so a repeat emit over the same dir never
 * re-judges the quarantine as foreign leftovers.
 *
 * No top-level `node:` imports (the H2 crash class) — fs/path load lazily
 * inside the call, like `fixtures.server.ts`'s loader.
 */

/** The quarantine dir every forced emit writes under (inside the emit dir). */
export const QUARANTINE_DIR_NAME = ".rapidtool-quarantine";

export type QuarantineFailure = {
  /** The emit-dir-relative path that could NOT be moved. */
  path: string;
  /** Why it could not be moved (never swallowed). */
  error: string;
};

export type QuarantineResult = {
  /** True when every requested path either moved or was already absent. */
  ok: boolean;
  /** The emit dir the quarantine belongs to (absolute, as passed). */
  dir: string;
  /** `<dir>/.rapidtool-quarantine/<stamp>` — null when nothing was requested. */
  quarantineDir: string | null;
  /** Rel paths moved, in request order. */
  moved: string[];
  /** Rel paths requested but not present on disk (already gone — reported, not failed). */
  missing: string[];
  /** Moves that threw — the tree still holds these; the caller must surface them. */
  failed: QuarantineFailure[];
};

/** Filesystem-safe quarantine stamp (ISO-8601 with `:`/`.` → `-`; Windows-legal). */
export function quarantineStamp(now: number = Date.now()): string {
  return new Date(now).toISOString().replace(/[:.]/g, "-");
}

/** True when `candidate` is `root` itself or strictly inside it (lexical containment). */
function isInside(root: string, candidate: string, sep: string): boolean {
  return candidate === root || candidate.startsWith(root.endsWith(sep) ? root : `${root}${sep}`);
}

/**
 * Move `relPaths` (emit-dir-relative, from the emit walk) into
 * `<dir>/.rapidtool-quarantine/<stamp>/<rel>`. Deterministic when `opts.ts` is
 * passed (tests); otherwise the current time. Missing sources are reported as
 * `missing`; a path that escapes the emit dir is refused into `failed` (never
 * moved outside the tree); I/O errors fall back to copy+unlink before failing.
 */
export async function quarantineFiles(
  dir: string,
  relPaths: string[],
  opts: { ts?: string; now?: number } = {},
): Promise<QuarantineResult> {
  const path = await import("node:path");
  const fs = await import("node:fs");
  const sep = path.sep;
  const root = path.resolve(dir);
  const normalized = relPaths
    .map((p) => String(p).split("\\").join("/"))
    .filter((p) => p.length > 0);

  const result: QuarantineResult = {
    ok: true,
    dir: root,
    quarantineDir: null,
    moved: [],
    missing: [],
    failed: [],
  };
  if (normalized.length === 0) return result;

  const stamp = opts.ts && opts.ts.length > 0 ? opts.ts : quarantineStamp(opts.now);
  const quarantineDir = path.join(root, QUARANTINE_DIR_NAME, stamp);
  result.quarantineDir = quarantineDir;

  for (const rel of normalized) {
    const src = path.resolve(root, rel);
    if (!isInside(root, src, sep)) {
      result.failed.push({ path: rel, error: "refused: path escapes the emit dir" });
      result.ok = false;
      continue;
    }
    if (!fs.existsSync(src)) {
      result.missing.push(rel);
      continue;
    }
    const dest = path.join(quarantineDir, rel);
    try {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.renameSync(src, dest);
      result.moved.push(rel);
    } catch (renameErr) {
      // Cross-device or a lock can refuse rename; copy+unlink is the fallback.
      try {
        fs.copyFileSync(src, dest);
        fs.unlinkSync(src);
        result.moved.push(rel);
      } catch (copyErr) {
        const message =
          copyErr instanceof Error ? copyErr.message : String(copyErr ?? renameErr);
        result.failed.push({ path: rel, error: `move failed: ${message}` });
        result.ok = false;
      }
    }
  }
  return result;
}
