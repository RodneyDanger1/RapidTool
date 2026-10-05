#!/usr/bin/env node
/**
 * P-B · C-09 — README "What ships" vs disk parity.
 *
 * Every file named in an emitted README's "What ships in this scaffold" table
 * must exist on disk. The historical defect (INC-28 / FINDINGS F-03): 7 of 13
 * trees listed `src/jobs/*.ts` modules that were never materialised, while a
 * paragraph ~50 lines below said they had NOT been emitted. The fix (lane A,
 * A10) filters the manifest to emitted paths and renders unmaterialised nodes
 * under a labelled "declared, NOT emitted" sub-table — rows there are exempt
 * by construction, not by an allowlist.
 *
 * Usage:
 *   node scripts/guards/readme-parity.mjs --trees <dir> [<dir> ...] [--json]
 *   node scripts/guards/readme-parity.mjs --root <testruns> [--json]
 *   node scripts/guards/readme-parity.mjs --registry scripts/guards/guard-registry.json [--json]
 *   node scripts/guards/readme-parity.mjs --selftest [--json]
 *
 * Exit codes: 0 clean / 1 finding · 2 usage.
 *
 * Exemptions are explicit, each with a written reason; an exemption whose path
 * now exists is STALE and fails this guard (the check-module-coverage ratchet).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { isMainModule, projectRoot } from "../with-app-env.mjs";

/**
 * Paths a README may legitimately reference that are not engine-emitted files.
 * Each entry carries the reason it is exempt; a now-existing path here is
 * reported STALE and fails the guard, so the map can only shrink for real.
 * @type {Record<string, string>}
 */
export const PARITY_ALLOWLIST = {
  "assets/":
    "directory expectation, not a file — the README says `assets/` is expected at the emitted scaffold and is NOT engine-generated",
  "public/":
    "directory expectation, not a file — the README says `public/` is expected at the emitted scaffold and is NOT engine-generated",
};

const WHAT_SHIPS_RE = /what ships/i;
const TABLE_ROW_RE = /^\|\s*`([^`]+)`\s*\|/;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const DECLARED_NOT_EMITTED_RE = /declared/i;

/** Is this heading the labelled sub-table for capabilities that were NOT emitted? */
function isDeclaredNotEmitted(title) {
  const t = title.toLowerCase();
  return DECLARED_NOT_EMITTED_RE.test(t) && /(not\s+emitted|unmaterialis|unmaterializ|not\s+materialis|never\s+emitted)/.test(t);
}

/** Normalize a README-listed path for lookup; returns null when it is not a file path. */
function listedPath(raw) {
  let p = String(raw).trim();
  if (p.startsWith("./")) p = p.slice(2);
  if (p.endsWith("/")) return null; // directory expectation marker
  if (p.length === 0) return null;
  return p;
}

/**
 * C-09 — findings for one tree's README. A tree without a README, or without a
 * "What ships" table, is skipped (no false "clean" and no fabricated finding).
 * @param {string} treeDir
 */
export function checkReadmeParity(treeDir, allowlist = PARITY_ALLOWLIST) {
  const readmePath = join(treeDir, "README.md");
  if (!existsSync(readmePath)) return { findings: [], skipped: true, reason: "no README.md" };
  let source;
  try {
    source = readFileSync(readmePath, "utf8");
  } catch {
    return { findings: [{ code: "RT_E_README_PARITY_UNREADABLE", path: "README.md", detail: "README.md could not be read" }], skipped: false };
  }
  const lines = source.split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const h = HEADING_RE.exec(lines[i]);
    if (h && WHAT_SHIPS_RE.test(h[2])) {
      start = i;
      break;
    }
  }
  if (start < 0) return { findings: [], skipped: true, reason: "no 'What ships' table" };

  let inDeclaredNotEmitted = false;
  /** @type {{ code: string, path: string, detail: string }[]} */
  const findings = [];
  /** @type {Set<string>} */
  const seen = new Set();
  for (let i = start + 1; i < lines.length; i += 1) {
    const heading = HEADING_RE.exec(lines[i]);
    if (heading) {
      if (isDeclaredNotEmitted(heading[2])) {
        inDeclaredNotEmitted = true;
        continue;
      }
      // The table ends at the next section; a sub-heading inside it (e.g. the
      // honesty note) also ends it unless it is the declared-not-emitted label.
      if (heading[1].length <= 2) break;
      continue;
    }
    if (inDeclaredNotEmitted) continue;
    const row = TABLE_ROW_RE.exec(lines[i]);
    if (!row) continue;
    const path = listedPath(row[1]);
    if (!path) continue;
    if (seen.has(path)) continue;
    seen.add(path);
    const reason = allowlist[path];
    const exists = existsSync(join(treeDir, path));
    if (reason !== undefined && exists) {
      findings.push({
        code: "RT_E_PARITY_STALE_ALLOWLIST",
        path,
        detail: `allowlist entry '${path}' is stale — it exists on disk now; delete the exemption (reason was: ${reason})`,
      });
      continue;
    }
    if (reason === undefined && !exists) {
      findings.push({
        code: "RT_E_README_PARITY",
        path,
        detail: `"What ships" lists '${path}' but it does not exist on disk`,
      });
    }
  }
  return { findings, skipped: false, readme: relative(treeDir, readmePath).replace(/\\/g, "/") };
}

/** Every `<root>/<slug>/emitted` and `<root>/<slug>/emitted.v2` directory. */
export function discoverTrees(root) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    for (const leaf of ["emitted", "emitted.v2"]) {
      const dir = join(root, entry.name, leaf);
      if (existsSync(dir) && statSync(dir).isDirectory()) out.push(dir);
    }
  }
  return out.sort();
}

/** Default testruns root: the sibling `testruns/` next to the repo, else in-repo. */
export function defaultTestrunsRoot() {
  const root = projectRoot();
  for (const candidate of [resolve(root, "..", "testruns"), join(root, "testruns")]) {
    if (existsSync(candidate)) return candidate;
  }
  return resolve(root, "..", "testruns");
}

/** Resolve a registry fixture spec against the repo and the testruns root. */
export function resolveFixture(spec, repoRoot, testrunsRoot) {
  if (isAbsolute(spec)) return existsSync(spec) ? spec : null;
  for (const candidate of [join(repoRoot, spec), join(testrunsRoot, spec)]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** @param {string} registryPath */
export function loadRegistry(registryPath) {
  const parsed = JSON.parse(readFileSync(registryPath, "utf8"));
  return Array.isArray(parsed.guards) ? parsed.guards : [];
}

/** The non-parity trees this guard must fire on (INC-28), and clean controls. */
export const SELFTEST_FIXTURES = [
  "flower-shop-website/emitted",
  "flower-shop-website/emitted.v2",
  "office-invoice-tracker/emitted",
  "office-scheduler/emitted",
  "office-scheduler/emitted.v2",
  "office-stock-tracker/emitted",
  "office-stock-tracker/emitted.v2",
  "mobile-companion/emitted.v2",
];
export const SELFTEST_CONTROLS = ["bakery-florist-orders/emitted", "mobile-companion/emitted"];

/** Run the fired-on-historical + clean-control proof for this guard. */
export function selftest() {
  const repoRoot = projectRoot();
  const testrunsRoot = defaultTestrunsRoot();
  const entries = [];
  let ok = true;
  const run = (spec, wantFire) => {
    const dir = resolveFixture(spec, repoRoot, testrunsRoot);
    if (!dir) return { fixture: spec, fired: false, controlClean: false, unresolved: true };
    const fired = checkReadmeParity(dir).findings.length > 0;
    if (fired !== wantFire) ok = false;
    return { fixture: spec, fired, want: wantFire ? "fires" : "clean", ok: fired === wantFire };
  };
  for (const spec of SELFTEST_FIXTURES) entries.push(run(spec, true));
  for (const spec of SELFTEST_CONTROLS) entries.push(run(spec, false));
  return { ok, entries };
}

function runRegistry(registryPath, json) {
  const repoRoot = projectRoot();
  const testrunsRoot = defaultTestrunsRoot();
  const entries = loadRegistry(registryPath).filter((e) => e && typeof e.file === "string" && e.file.endsWith("readme-parity.mjs"));
  const results = [];
  let failed = false;
  for (const entry of entries) {
    // Registry entries name one or more fixtures that must fire, plus controls.
    const fixtures = Array.isArray(entry.historicalFixtures) ? entry.historicalFixtures : [entry.historicalFixture];
    const controls = Array.isArray(entry.cleanControls) ? entry.cleanControls : entry.cleanControl ? [entry.cleanControl] : [];
    let fired = true;
    let controlsClean = true;
    for (const spec of fixtures) {
      const dir = resolveFixture(String(spec), repoRoot, testrunsRoot);
      if (!dir || checkReadmeParity(dir).findings.length === 0) fired = false;
    }
    for (const spec of controls) {
      const dir = resolveFixture(String(spec), repoRoot, testrunsRoot);
      if (!dir || checkReadmeParity(dir).findings.length > 0) controlsClean = false;
    }
    if (!fired || !controlsClean) failed = true;
    results.push({ id: entry.id, fired, controlsClean, ok: fired && controlsClean });
  }
  if (json) console.log(JSON.stringify({ guard: "readme-parity", entries: results, ok: !failed }, null, 2));
  else for (const r of results) console.log(`[readme-parity] ${r.id}: fired=${r.fired} controlsClean=${r.controlsClean}${r.ok ? "" : "  ✗"}`);
  return failed ? 1 : 0;
}

function usage(message) {
  if (message) console.error(`[readme-parity] ${message}`);
  console.error("usage: node scripts/guards/readme-parity.mjs --trees <dir...> | --root <dir> | --registry <json> | --selftest [--json]");
  process.exit(2);
}

function main(argv) {
  const json = argv.includes("--json");
  const args = argv.filter((a) => a !== "--json");
  const repoRoot = projectRoot();

  if (args.includes("--selftest")) {
    const result = selftest();
    if (json) console.log(JSON.stringify({ guard: "readme-parity", selftest: result }, null, 2));
    else for (const e of result.entries) console.log(`[readme-parity] selftest ${e.fixture}: ${e.ok ? "ok" : "MISS"} (${e.want})`);
    return result.ok ? 0 : 1;
  }

  const registryAt = args.indexOf("--registry");
  if (registryAt >= 0) {
    const path = args[registryAt + 1];
    if (!path) usage("--registry needs a path");
    return runRegistry(path, json);
  }

  /** @type {string[]} */
  let trees = [];
  const treesAt = args.indexOf("--trees");
  if (treesAt >= 0) {
    for (const value of args.slice(treesAt + 1)) {
      if (value.startsWith("--")) break;
      trees.push(resolve(repoRoot, value));
    }
  }
  const rootAt = args.indexOf("--root");
  if (rootAt >= 0) {
    const root = args[rootAt + 1];
    if (!root) usage("--root needs a directory");
    trees = discoverTrees(resolve(repoRoot, root));
  }
  if (trees.length === 0 && treesAt < 0 && rootAt < 0) trees = discoverTrees(defaultTestrunsRoot());
  const unreadable = trees.filter((t) => !existsSync(t));
  if (unreadable.length > 0) usage(`unreadable tree(s): ${unreadable.join(", ")}`);

  const reports = trees.map((t) => ({ dir: t, ...checkReadmeParity(t) }));
  const total = reports.reduce((n, r) => n + r.findings.length, 0);
  if (json) {
    console.log(JSON.stringify({ guard: "readme-parity", trees: reports.map((r) => ({ dir: r.dir, skipped: r.skipped, findings: r.findings })), findings: total, ok: total === 0 }, null, 2));
  } else {
    for (const report of reports) for (const f of report.findings) console.log(`${f.code} ${basename(report.dir)}/${f.path}: ${f.detail}`);
    console.log(`[readme-parity] ${reports.length} tree(s) scanned · ${total} finding(s)`);
  }
  return total === 0 ? 0 : 1;
}

if (isMainModule(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
