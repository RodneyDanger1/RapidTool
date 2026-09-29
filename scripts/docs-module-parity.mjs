#!/usr/bin/env node
/**
 * docs-module-parity.mjs — OV-20 (ADVISORY ONLY) · W31 lane T5 · fixes/273_t5_board.md
 *
 * The row (220_tasklist_canonical.md OV-20; folded from 225 hunt-1; MODIFY per D3.3 /
 * fixes/228 §3 #18): "an advisory report lists docs-claimed modules that are missing/empty —
 * report-only, never a gate, zero false-positive enforcement."
 *
 * What it does: scans a FIXED doc set for backticked repo code paths (`src/...`, `scripts/...`,
 * `migrations/...` with a code extension), then reports which of those paths do not exist on
 * disk or exist with zero bytes. It NEVER fails a build, NEVER wires into scripts/gate.sh,
 * and always exits 0 when the scan itself completed — findings are data, not red.
 *
 * Honest limits (stated so nobody over-trusts it): it is a lexer-level heuristic over prose —
 * a path inside a historical/fenced example may be flagged even though the doc is honest about
 * its state ("was", "removed"). That is exactly why the output is advisory and why this script
 * must never be promoted to a gate. Its own correctness is checked against a synthetic fixture
 * only at run time (`--self-check`), never by CI.
 *
 * Usage:  node scripts/docs-module-parity.mjs [--self-check] [--cwd <dir>]
 * Output: ONE JSON object on stdout (the repo's CLI-style envelope shape).
 */

import { readFileSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const selfCheck = args.includes("--self-check");
const cwdIdx = args.indexOf("--cwd");
const ROOT = cwdIdx >= 0 && args[cwdIdx + 1] ? resolve(args[cwdIdx + 1]) : process.cwd();

/** The fixed doc set (root docs + the CLI contract). Additive by design — edit deliberately. */
export const DOCS = [
  "AGENTS.md",
  "README.md",
  "START-HERE.md",
  "RESUME.md",
  "AGENT_GUIDE.md",
  "scripts/README-cli.md",
  "taskuniverselog.md",
  "remainingwaves.md",
];

/** Backticked repo code paths: `src/…`, `scripts/…`, `migrations/…` ending in a code extension. */
const PATH_RE = /`((?:src|scripts|migrations)\/[A-Za-z0-9_./@-]+?\.(?:ts|tsx|mjs|js|json|sql))`/g;

function scanDoc(doc) {
  const abs = join(ROOT, doc);
  if (!existsSync(abs)) return { doc, read: false, paths: [] };
  const text = readFileSync(abs, "utf8");
  const paths = [];
  for (const m of text.matchAll(PATH_RE)) paths.push(m[1]);
  return { doc, read: true, paths };
}

function audit(entries) {
  const seen = new Map(); // path -> { docs: Set }
  for (const e of entries) for (const p of e.paths) {
    if (!seen.has(p)) seen.set(p, new Set());
    seen.get(p).add(e.doc);
  }
  const missing = [];
  const empty = [];
  for (const [p, docs] of seen) {
    const abs = join(ROOT, p);
    if (!existsSync(abs)) {
      missing.push({ path: p, claimedBy: [...docs].sort() });
      continue;
    }
    const st = statSync(abs);
    if (st.isFile() && st.size === 0) empty.push({ path: p, claimedBy: [...docs].sort() });
  }
  return { unique: seen.size, missing, empty };
}

function main() {
  const entries = DOCS.map(scanDoc);
  const unread = entries.filter((e) => !e.read).map((e) => e.doc);
  const { unique, missing, empty } = audit(entries);
  return {
    ok: true,
    cmd: "docs-module-parity",
    advisory: true,
    gate: false,
    note:
      "ADVISORY-ONLY (OV-20): report data only — this probe is deliberately NOT wired into scripts/gate.sh and never fails a build. " +
      "Lexer-level heuristic over prose; historical/fenced examples may appear. Parent owns keep-or-cut (240 §Tier-2).",
    root: ROOT,
    docsScanned: entries.filter((e) => e.read).length,
    docsUnreadable: unread,
    mentions: entries.reduce((n, e) => n + e.paths.length, 0),
    uniquePaths: unique,
    missingCount: missing.length,
    emptyCount: empty.length,
    missing,
    empty,
    selfCheck: selfCheck ? "requested — synthetic fixtures below" : "not requested (no fixtures computed)",
    ...(selfCheck
      ? {
          fixtures: {
            // In-memory self-check: verify the audit logic on synthetic inputs (no repo dependence).
            missingDetected: audit([{ doc: "<fixture>", paths: ["src/lib/__no_such_file__.ts"] }]).missing.length === 1,
            existingNotFlagged: audit([{ doc: "<fixture>", paths: ["package.json"] }]).missing.length === 0,
          },
        }
      : {}),
  };
}

try {
  process.stdout.write(JSON.stringify(main(), null, 2) + "\n");
  process.exitCode = 0; // findings are NEVER an error — advisory only
} catch (err) {
  process.stdout.write(
    JSON.stringify({
      ok: false,
      cmd: "docs-module-parity",
      advisory: true,
      error: err instanceof Error ? err.message : String(err),
    }) + "\n",
  );
  process.exitCode = 1; // only the scanner's own crash is red
}
