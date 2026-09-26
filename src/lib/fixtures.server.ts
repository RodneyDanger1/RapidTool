/**
 * T5.2-A — fixtures review surface · SERVER LOADER (read-only).
 *
 * Reads `research/eval-corpus/*.md` + `research/eval-corpus/graders/*.grader.json`
 * from disk and returns typed rows via the pure parsers in `./fixtures.ts`.
 *
 * `node:fs` is imported LAZILY inside the function (the codebase's server-only
 * seam — the H2 crash class: client-safe modules must not import `node:` at top
 * level). Read-only by construction: this module has no write path, and it
 * never copies a grader anywhere — the grader is run-side authority
 * (`graderLeakScan` pins that).
 */

import { fixtureReviewRows, graderSlug, parseFixtureFrontmatter, parseGrader, type FixtureReviewRow } from "./fixtures.ts";

export interface FixtureLoadResult {
  ok: boolean;
  corpusDir: string;
  rows: FixtureReviewRow[];
  /** Read problems (unreadable files, missing dir) — surfaced, never hidden. */
  problems: string[];
  label: string;
}

const LOAD_LABEL =
  "read-only review — the grader is run-side authority; approving here records a decision, it does not modify the bar";

/**
 * Load every corpus fixture (+ its grader, when present) as review rows.
 *
 * `corpusDir` defaults to `<cwd>/research/eval-corpus`. A missing directory is
 * an honest `ok:false` with the reason — never an empty lie.
 */
export async function loadFixtureReviewRows(corpusDir?: string): Promise<FixtureLoadResult> {
  const path = await import("node:path");
  const fs = await import("node:fs/promises");
  const dir = corpusDir ?? path.resolve(process.cwd(), "research", "eval-corpus");
  const graderDir = path.join(dir, "graders");
  const problems: string[] = [];

  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch (e) {
    return {
      ok: false,
      corpusDir: dir,
      rows: [],
      problems: [`corpus dir unreadable: ${e instanceof Error ? e.message : String(e)}`],
      label: LOAD_LABEL,
    };
  }

  const fixtureNames = names.filter((n) => n.toLowerCase().endsWith(".md")).sort();

  let graderNames: string[] = [];
  try {
    graderNames = (await fs.readdir(graderDir)).filter((n) => n.toLowerCase().endsWith(".json")).sort();
  } catch {
    problems.push("graders dir unreadable — every fixture will surface as bar-missing");
  }

  const fixtures = [];
  for (const n of fixtureNames) {
    try {
      const text = await fs.readFile(path.join(dir, n), "utf8");
      fixtures.push(parseFixtureFrontmatter(text, n));
    } catch (e) {
      problems.push(`fixture unreadable: ${n}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const graders = [];
  for (const n of graderNames) {
    try {
      const text = await fs.readFile(path.join(graderDir, n), "utf8");
      graders.push(parseGrader(text, n));
    } catch (e) {
      problems.push(`grader unreadable: ${n}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const rows = fixtureReviewRows(fixtures, graders);
  // A grader file with no fixture is a real inconsistency — surface it rather
  // than dropping it silently (the surface must never under-report).
  const fixtureSlugs = new Set(fixtures.map((f) => f.slug));
  for (const g of graders) {
    if (!fixtureSlugs.has(graderSlug(g))) problems.push(`orphan grader (no fixture for slug): ${graderSlug(g)}`);
  }

  return { ok: true, corpusDir: dir, rows, problems, label: LOAD_LABEL };
}
