#!/usr/bin/env node
/**
 * P-B · Q2 — CAMPAIGN #1 residual invariants (PR-28).
 *
 * A static, keyless scan over the frozen CAMPAIGN #1 artifacts
 * (`testruns/campaign1/<slug>/`) that fails closed on the four campaign
 * defects no runner-level gate currently catches:
 *
 *   C1-01  RT_E_PLAN_UNDERPRODUCED  a tree SEALED below `minimumTreeFileCount`
 *          with no floor refusal in its delivery envelope (a silent partial,
 *          not the registered floor code, INC C1-01).
 *   C1-02  RT_E_UI_UNWIRED          a tree whose spec graph declares a UI but
 *          whose mounted console never CALLS a real generated export
 *          (INC C1-02; `uiWired:false` on 8/8 campaign trees).
 *   C1-05  RT_E_SPEC_SKIP_VACUOUS   an oracle spec whose live tests are
 *          dominated by `test.skip`/`test.todo` rows, so a green run is
 *          vacuity, not behaviour (INC C1-05; 7-8/9 SKIP).
 *   C1-06  RT_E_CLAIM_UNVERIFIED    a delivery record that CLAIMS a product
 *          (git.commit landed) without stating its real verification
 *          (tree-run verdict + verdict/evidence hash + UI wiring) and without
 *          saying unverified (INC C1-06; the real-substance commits).
 *
 * The guards read REAL bytes: the emitted tree on disk, the persisted
 * `.rapidtool/project.json`, the emitted `tests/oracle.spec.ts`, the mounted
 * `src/ui/*` console, and the sealed `emit*.json` envelopes. The floor and the
 * real-module census come from the REAL seams (`minimumTreeFileCount` from
 * `src/lib/codegen.server.ts`, `treeSubstanceOf` from
 * `src/lib/compile-check.server.ts`) — nothing here mocks the object under test.
 *
 * Every finding names the exact campaign slug/tree it fired on. Each detector
 * has a clean/mutation control in `campaign-invariants.test.mjs`; the P-A
 * harness's `--selftest` proves the same discrimination inline.
 *
 * Usage:
 *   node scripts/guards/campaign-invariants.mjs [--root <dir>] [--only <floor|ui|skip|claim>] [--json] [--selftest]
 *
 * Exit codes:
 *   0  no finding (lint) / the selftest proofs hold
 *   1  at least one finding / a selftest proof failed
 *   2  usage / no campaign root (fail closed)
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { maskCommentsOnly, maskLiteralsAndComments } from "./tree-invariants.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, "..", "..");
export const CAMPAIGN_CASSETTE_DIR = join(REPO_ROOT, "scripts", "prevention", "cassettes", "campaign1");

const FLOOR_CODE = "RT_E_PLAN_UNDERPRODUCED";
const UI_CODE = "RT_E_UI_UNWIRED";
const SKIP_CODE = "RT_E_SPEC_SKIP_VACUOUS";
const CLAIM_CODE = "RT_E_CLAIM_UNVERIFIED";
const GIT_CODE = "RT_E_GIT_CODE_INCONSISTENT";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "coverage", ".output", ".vercel", ".next"]);
const SOURCE_RE = /\.(?:ts|tsx|js|jsx|mjs)$/;
const SKIP_HEADER = "DECLARED SCRIPTS NOT RUN";

/** Read a text file, "" on any failure (never throws, never guesses). */
function safeRead(p) {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

/**
 * Read a JSON artifact, tolerating a UTF-8 BOM. Returns null when absent or
 * unparseable (the caller skips, never invents).
 * @param {string} p
 * @returns {any}
 */
export function readJsonArtifact(p) {
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Campaign root resolution + discovery.
// ---------------------------------------------------------------------------

/**
 * Locate the frozen campaign artifacts. The in-repo cassette copy (real bytes,
 * pinned) wins so the guard is self-contained and deterministic; the live
 * campaign root is the fallback, and `RAPIDTOOL_CAMPAIGN_ROOT` overrides both.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string|null}
 */
export function resolveCampaignRoot(env = process.env) {
  const candidates = [
    env.RAPIDTOOL_CAMPAIGN_ROOT,
    CAMPAIGN_CASSETTE_DIR,
    resolve(REPO_ROOT, "..", "testruns", "campaign1"),
    join(REPO_ROOT, "testruns", "campaign1"),
  ];
  for (const c of candidates) {
    if (c && existsSync(c) && statSync(c).isDirectory()) return c;
  }
  return null;
}

/**
 * Every `<root>/<slug>` that carries an `emitted/` tree (live) or a
 * `tree.sources.json` cassette bundle, sorted.
 */
export function listCampaignSlugs(root) {
  if (!root || !existsSync(root)) return [];
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith("_") || SKIP_DIRS.has(e.name)) continue;
    if (existsSync(join(root, e.name, "emitted")) || existsSync(join(root, e.name, "tree.sources.json"))) out.push(e.name);
  }
  return out.sort();
}

/**
 * The pinned cassette stores the emitted tree as one JSON bundle
 * (`tree.sources.json`) so the real bytes live under `scripts/**` without the
 * scripts typecheck program compiling the emitted `.ts`/`.tsx`. Materialize it
 * once per slug into a temp dir; removed on exit.
 * @type {Map<string,string|null>}
 */
const MATERIALIZED = new Map();
let MATERIALIZE_ROOT = null;
/** @param {string} slugDir @param {string} slug @returns {string|null} */
function materializeCassetteTree(slugDir, slug) {
  if (MATERIALIZED.has(slugDir)) return MATERIALIZED.get(slugDir) ?? null;
  const bundle = readJsonArtifact(join(slugDir, "tree.sources.json"));
  let dir = null;
  if (bundle && typeof bundle === "object" && bundle.files && typeof bundle.files === "object") {
    if (MATERIALIZE_ROOT === null) {
      MATERIALIZE_ROOT = mkdtempSync(join(tmpdir(), "rt-campaign-cassette-"));
      process.on("exit", () => {
        try {
          if (MATERIALIZE_ROOT) rmSync(MATERIALIZE_ROOT, { recursive: true, force: true });
        } catch {
          /* best effort */
        }
      });
    }
    dir = join(MATERIALIZE_ROOT, slug);
    for (const [rel, content] of Object.entries(bundle.files)) {
      const p = join(dir, rel);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, String(content));
    }
  }
  MATERIALIZED.set(slugDir, dir);
  return dir;
}

/**
 * The emitted-tree directory for a slug: the live `emitted/` when present, else
 * the materialized cassette bundle. `null` when neither exists (fail closed).
 * @param {string} root @param {string} slug @returns {string|null}
 */
export function campaignTreeDir(root, slug) {
  const slugDir = join(root, slug);
  const live = join(slugDir, "emitted");
  if (existsSync(live)) return live;
  return materializeCassetteTree(slugDir, slug) ?? null;
}

/** The sealed delivery envelopes at a slug dir (`emit.json`, `emit-banner.json`). */
export function sealEnvelopes(slugDir) {
  const out = [];
  for (const name of ["emit.json", "emit-banner.json"]) {
    const p = join(slugDir, name);
    if (!existsSync(p)) continue;
    const j = readJsonArtifact(p);
    out.push({ name, path: p, raw: safeRead(p), json: j });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Real seams (imported lazily, never mocked).
// ---------------------------------------------------------------------------

let seamsCache = null;
/** Import the REAL floor + substance seams once. @returns {Promise<{minimumTreeFileCount:any, treeSubstanceOf:any, error:string|null}>} */
export async function loadCampaignSeams() {
  if (seamsCache) return seamsCache;
  let minimumTreeFileCount = null;
  let treeSubstanceOf = null;
  let error = null;
  try {
    const cg = await import(new URL("../../src/lib/codegen.server.ts", import.meta.url).href);
    minimumTreeFileCount = typeof cg.minimumTreeFileCount === "function" ? cg.minimumTreeFileCount : null;
  } catch (e) {
    error = `codegen.server.ts: ${String(e && e.message ? e.message : e)}`;
  }
  try {
    const cc = await import(new URL("../../src/lib/compile-check.server.ts", import.meta.url).href);
    treeSubstanceOf = typeof cc.treeSubstanceOf === "function" ? cc.treeSubstanceOf : null;
  } catch (e) {
    error = (error ? error + "; " : "") + `compile-check.server.ts: ${String(e && e.message ? e.message : e)}`;
  }
  seamsCache = { minimumTreeFileCount, treeSubstanceOf, error };
  return seamsCache;
}

// ---------------------------------------------------------------------------
// Tree source helpers.
// ---------------------------------------------------------------------------

/** Every source file under a tree, excluding vendor/build/dot dirs (posix, tree-relative). */
export function walkTreeSources(treeDir) {
  const out = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".") || SKIP_DIRS.has(e.name)) continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if (!e.isSymbolicLink()) walk(full);
      } else if (SOURCE_RE.test(e.name) && !/\.d\.(?:ts|mts)$/.test(e.name)) {
        out.push(full);
      }
    }
  };
  walk(treeDir);
  return out.sort();
}

/** Relative POSIX path of `file` under `root`. */
function relPosix(root, file) {
  const r = resolve(root);
  const f = resolve(file);
  const p = f.startsWith(r) ? f.slice(r.length) : f;
  return p.replace(/\\/g, "/").replace(/^\/+/, "");
}

const EXPORT_DECL_RE = /(^|\n)[ \t]*export\s+(?:async\s+)?(?:function|const|let|var|class|enum)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
const EXPORT_LIST_RE = /(^|\n)[ \t]*export\s*\{([^}]*)\}/g;

/** Top-level exported names of a module (masked source). */
export function exportedNames(source) {
  const masked = maskLiteralsAndComments(source);
  const out = new Set();
  EXPORT_DECL_RE.lastIndex = 0;
  let m;
  while ((m = EXPORT_DECL_RE.exec(masked)) !== null) out.add(m[2]);
  EXPORT_LIST_RE.lastIndex = 0;
  while ((m = EXPORT_LIST_RE.exec(masked)) !== null) {
    for (const part of m[2].split(",")) {
      const t = part.trim();
      if (!t) continue;
      const bits = t.split(/\s+as\s+/);
      const name = (bits.length === 2 ? bits[1] : bits[0]).trim();
      if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) out.add(name);
    }
  }
  return out;
}

/** Resolve a relative import specifier to a real source file inside the tree. */
export function resolveTreeSpecifier(spec, fromFile) {
  if (!spec.startsWith(".")) return null;
  const base = resolve(dirname(fromFile), spec);
  const candidates = [base];
  if (!extname(base)) {
    candidates.push(`${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`, `${base}.mjs`, join(base, "index.ts"));
  } else if (base.endsWith(".js")) {
    candidates.push(`${base.slice(0, -3)}.ts`, `${base.slice(0, -3)}.tsx`);
  }
  for (const c of candidates) {
    try {
      if (statSync(c).isFile()) return c;
    } catch {
      /* next candidate */
    }
  }
  return null;
}

/** Relative `export * from` / `export {..} from` targets of a module (strings intact). */
function reexportTargets(source) {
  const masked = maskCommentsOnly(source);
  const out = [];
  for (const m of masked.matchAll(/(^|\n)[ \t]*export\s*\*\s*from\s*["']([^"']+)["']/g)) out.push({ spec: m[2], names: null });
  for (const m of masked.matchAll(/(^|\n)[ \t]*export\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
    const names = m[2]
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => (x.split(/\s+as\s+/).pop() || "").trim())
      .filter(Boolean);
    out.push({ spec: m[3], names });
  }
  return out;
}

/**
 * Expand a resolved module to the tree modules that actually PROVIDE an export
 * named `name` (barrels followed transitively). Returns absolute provider paths.
 */
export function realProvidersOf(targetFile, name) {
  const source = safeRead(targetFile);
  const own = exportedNames(source);
  const targets = reexportTargets(source);
  if (targets.length === 0) return own.has(name) ? [targetFile] : [];
  const providers = [];
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = safeRead(file);
    const names = exportedNames(src);
    const inner = reexportTargets(src);
    if (names.has(name)) providers.push(file);
    for (const t of inner) {
      if (t.names && !t.names.includes(name)) continue;
      const next = resolveTreeSpecifier(t.spec, file);
      if (next) visit(next);
    }
  };
  for (const t of targets) {
    if (t.names && !t.names.includes(name)) continue;
    const next = resolveTreeSpecifier(t.spec, targetFile);
    if (next) visit(next);
  }
  return providers;
}

// ---------------------------------------------------------------------------
// Detector C1-01 — floor reachability.
// ---------------------------------------------------------------------------

/**
 * A tree SEALED below `minimumTreeFileCount` must carry `RT_E_PLAN_UNDERPRODUCED`
 * in its delivery envelope; a below-floor tree whose seal is silent (or uses a
 * generic validation code) is the C1-01 defect.
 * @param {string} slugDir @param {string} treeDir @param {(project:any,spec:any)=>number} floorOf
 */
export function detectFloorReachability(slugDir, treeDir, floorOf) {
  const project = readJsonArtifact(join(treeDir, ".rapidtool", "project.json"));
  if (!project) return [];
  const seals = sealEnvelopes(slugDir);
  if (seals.length === 0) return []; // not sealed — nothing was delivered to judge
  const sigs = Array.isArray(project.implementationSpec?.typeSignatures) ? project.implementationSpec.typeSignatures : [];
  let floor = 0;
  try {
    floor = floorOf(project, { typeSignatures: sigs });
  } catch {
    return [];
  }
  const emitted = Array.isArray(project.generatedTree) ? project.generatedTree.length : 0;
  if (emitted >= floor) return [];
  const carriesFloorCode = seals.some((s) => s.raw.includes(FLOOR_CODE));
  if (carriesFloorCode) return [];
  const sealCodes = seals.map((s) => (s.json && (s.json.code || (s.json.git && s.json.git.code))) || null).filter(Boolean);
  return [
    {
      code: FLOOR_CODE,
      slug: basename(slugDir),
      tree: basename(treeDir),
      floor,
      emitted,
      sealCodes,
      detail: `sealed with ${emitted} generatedTree file(s) below the floor of ${floor} and no ${FLOOR_CODE} in the delivery envelope (seal codes: ${sealCodes.join(", ") || "none"})`,
    },
  ];
}

// ---------------------------------------------------------------------------
// Detector C1-02 — mounted UI must call a real generated export.
// ---------------------------------------------------------------------------

/** The real generated modules of a tree (kind === "real" in the substance census). */
function realModuleSet(treeDir, treeSubstanceOf) {
  const set = new Set();
  if (typeof treeSubstanceOf !== "function") return set;
  let census;
  try {
    census = treeSubstanceOf(treeDir, { green: true });
  } catch {
    return set;
  }
  for (const f of Array.isArray(census.files) ? census.files : []) {
    if (f && f.kind === "real" && typeof f.path === "string") set.add(f.path.replace(/\\/g, "/"));
  }
  return set;
}

/** Does the spec graph declare a UI surface? */
function declaresUi(project) {
  const nodes = Array.isArray(project?.specGraph?.nodes) ? project.specGraph.nodes : [];
  return nodes.some(
    (n) =>
      n &&
      typeof n === "object" &&
      (/^(?:ui|console|shell)$/i.test(String(n.id ?? "")) || String(n.file ?? "").replace(/\\/g, "/").startsWith("src/ui/")),
  );
}

/** Parsed generated imports of a console source (bindings + specifier). */
export function parseUiImports(source) {
  const masked = maskCommentsOnly(source);
  const out = [];
  for (const m of masked.matchAll(/(^|\n)[ \t]*import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s+["']([^"']+)["']/g)) {
    out.push({ ns: m[2], names: [], spec: m[3] });
  }
  for (const m of masked.matchAll(/(^|\n)[ \t]*import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
    const names = m[2]
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => (x.split(/\s+as\s+/).pop() || "").trim())
      .filter(Boolean);
    out.push({ ns: null, names, spec: m[3] });
  }
  return out;
}

/** Named exports the source CALLS from `ns` (namespace member calls). */
function nsCalls(source, ns) {
  const masked = maskLiteralsAndComments(source);
  const out = new Set();
  const re = new RegExp(`\\b${ns.replace(/\$/g, "\\$")}\\s*\\.\\s*([A-Za-z_$][\\w$]*)\\s*\\(`, "g");
  for (const m of masked.matchAll(re)) out.add(m[1]);
  return out;
}

/** Names the source CALLS directly (bare call sites). */
function bareCalls(source, names) {
  const masked = maskLiteralsAndComments(source);
  const out = new Set();
  for (const name of names) {
    const re = new RegExp(`(^|[^.[\\w$])${name.replace(/\$/g, "\\$")}\\s*\\(`, "m");
    if (re.test(masked)) out.add(name);
  }
  return out;
}

/**
 * A tree whose spec graph declares a UI must mount at least one REAL generated
 * export: a console/entry module that imports a generated module and CALLS an
 * export that resolves (through barrels) to a module the substance census reads
 * as real. Otherwise the UI is a stub wall (C1-02).
 * @param {string} treeDir @param {(dir:string,opts:any)=>any} treeSubstanceOf @param {string} [slug]
 */
export function detectUiWiring(treeDir, treeSubstanceOf, slug) {
  const label = slug || basename(dirname(treeDir));
  const project = readJsonArtifact(join(treeDir, ".rapidtool", "project.json"));
  if (!project || !declaresUi(project)) return [];
  const uiFiles = walkTreeSources(treeDir).filter((f) => /[\\/]src[\\/](?:ui[\\/]|main\.[tj]sx?$)/.test(f));
  if (uiFiles.length === 0) {
    return [{ code: UI_CODE, slug: label, tree: "emitted", detail: "spec graph declares a UI but no src/ui or src/main entry exists" }];
  }
  const real = realModuleSet(treeDir, treeSubstanceOf);
  for (const file of uiFiles) {
    const source = safeRead(file);
    for (const imp of parseUiImports(source)) {
      const target = resolveTreeSpecifier(imp.spec, file);
      if (!target) continue;
      if (imp.ns) {
        for (const called of nsCalls(source, imp.ns)) {
          const providers = realProvidersOf(target, called);
          if (providers.some((p) => real.has(relPosix(treeDir, p)))) {
            return [];
          }
        }
      }
      if (imp.names.length > 0) {
        for (const called of bareCalls(source, imp.names)) {
          const providers = realProvidersOf(target, called);
          if (providers.some((p) => real.has(relPosix(treeDir, p)))) {
            return [];
          }
        }
      }
    }
  }
  return [
    {
      code: UI_CODE,
      slug: label,
      tree: "emitted",
      realModules: [...real],
      detail: `spec graph declares a UI but no mounted console/entry CALLS an export of a real generated module (real modules: ${[...real].join(", ") || "none"})`,
    },
  ];
}

// ---------------------------------------------------------------------------
// Detector C1-05 — skip-dominated oracle spec.
// ---------------------------------------------------------------------------

/** Census of live vs skipped rows in an oracle spec (comments/strings masked). */
export function specRowCensus(source) {
  const masked = maskLiteralsAndComments(source);
  const skipped =
    (masked.match(/\b(?:test|it)\.skip\s*\(/g) || []).length +
    (masked.match(/\b(?:test|it)\.todo\s*\(/g) || []).length +
    (masked.match(/\b(?:test|it)\.skipIf\s*\(/g) || []).length;
  const live = (masked.match(/(^|[^.\w$])(?:test|it)\s*\(/g) || []).length;
  const total = live + skipped;
  return { live, skipped, total, skippedRatio: total > 0 ? skipped / total : 0 };
}

/**
 * A skip-dominated oracle (`skipped >= live`, at least one skip) can green
 * `npm test` while asserting nothing — it must not satisfy the behavioural/
 * `tested` bar (C1-05).
 * @param {string} treeDir @param {string} [slug]
 */
export function detectSkipVacuity(treeDir, slug) {
  const label = slug || basename(dirname(treeDir));
  const spec = join(treeDir, "tests", "oracle.spec.ts");
  if (!existsSync(spec)) return [];
  const source = safeRead(spec);
  const census = specRowCensus(source);
  if (census.skipped >= 1 && census.skipped >= census.live) {
    return [
      {
        code: SKIP_CODE,
        slug: label,
        tree: "emitted",
        live: census.live,
        skipped: census.skipped,
        skippedRatio: Number(census.skippedRatio.toFixed(3)),
        detail: `${census.skipped} skipped / ${census.live} live oracle row(s) (${Math.round(census.skippedRatio * 100)}% SKIP) — a green run here is vacuity, not behaviour`,
      },
    ];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Detector C1-06 — unverified delivery claim.
// ---------------------------------------------------------------------------

/** Does this envelope CLAIM a delivered product? */
function claimsProduct(j) {
  return !!(j && j.git && j.git.committed === true);
}

/** Does the envelope state its REAL verification (verdict + hash + UI wiring)? */
function statesRealVerification(j) {
  if (!j) return false;
  const verdictOk = j.treeRun && j.treeRun.ok === true;
  const hash = (j.treeRun && (j.treeRun.verdictHash || j.treeRun.evidenceHash)) || (j.tested && j.tested.evidenceHash) || null;
  const uiWired = j.uiWired === true || (j.ui && j.ui.wired === true);
  return !!(verdictOk && hash && uiWired);
}

/** Does the envelope SAY the claim is unverified? */
function saysUnverified(j) {
  if (!j) return false;
  return j.unverified === true || j.verifiedClaim === false || j.verification === "unverified";
}

/**
 * A delivery record claiming a product must either state its real verification
 * (tree-run verdict + verdict/evidence hash + UI wiring) or explicitly say
 * unverified. A commit whose README warns the declared scripts were never run
 * while the record claims `declaredScriptsVerified` is an overclaim (C1-06).
 * @param {string} slugDir @param {string} treeDir
 */
export function detectUnverifiedClaim(slugDir, treeDir) {
  const findings = [];
  const readmeWarning = safeRead(join(treeDir, "README.md")).includes(SKIP_HEADER);
  for (const seal of sealEnvelopes(slugDir)) {
    const j = seal.json;
    if (!claimsProduct(j)) continue;
    if (statesRealVerification(j)) continue;
    if (saysUnverified(j)) continue;
    findings.push({
      code: CLAIM_CODE,
      slug: basename(slugDir),
      envelope: seal.name,
      committed: true,
      uiWired: j.uiWired === true || (j.ui && j.ui.wired === true),
      verdictHash: (j.treeRun && j.treeRun.verdictHash) || null,
      readmeWarns: readmeWarning,
      detail:
        `${seal.name} commits a product without stating its real verification ` +
        `(tree-run verdict + verdict/evidence hash + UI wiring) and without saying unverified` +
        (readmeWarning ? `; the emitted README still warns "${SKIP_HEADER}"` : ""),
    });
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Detector C1-08 — withheld git envelope code consistency.
// ---------------------------------------------------------------------------

/**
 * A withheld `git` sub-envelope must carry the DECIDING reason's code, exactly
 * as the top-level `code` does. The historical inconsistency (C1-08):
 * `git.reason:"substance-empty"` beside `git.code:"RT_E_TREE_RUN_FAILED"` while
 * the top-level `code` read `RT_E_SUBSTANCE_EMPTY`.
 * @param {string} slugDir
 */
export function detectGitCodeInconsistency(slugDir) {
  const findings = [];
  for (const seal of sealEnvelopes(slugDir)) {
    const j = seal.json;
    if (!j || !j.git) continue;
    const gitCode = j.git.code;
    const topCode = j.code;
    const reason = j.git.reason;
    if (typeof gitCode === "string" && typeof topCode === "string" && gitCode !== topCode) {
      findings.push({
        code: GIT_CODE,
        slug: basename(slugDir),
        envelope: seal.name,
        reason: typeof reason === "string" ? reason : null,
        gitCode,
        topCode,
        detail: `${seal.name} withholds with reason "${reason}" but its git.code (${gitCode}) disagrees with the envelope code (${topCode})`,
      });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Scan + CLI.
// ---------------------------------------------------------------------------

/** Run every detector over the campaign trees. */
export async function scanCampaign(root, only = null) {
  const { minimumTreeFileCount, treeSubstanceOf, error } = await loadCampaignSeams();
  const slugs = listCampaignSlugs(root);
  const findings = [];
  const run = {
    floor: (slug, slugDir, treeDir) => (typeof minimumTreeFileCount === "function" ? detectFloorReachability(slugDir, treeDir, minimumTreeFileCount) : []),
    ui: (slug, _slugDir, treeDir) => detectUiWiring(treeDir, treeSubstanceOf, slug),
    skip: (slug, _slugDir, treeDir) => detectSkipVacuity(treeDir, slug),
    claim: (_slug, slugDir, treeDir) => detectUnverifiedClaim(slugDir, treeDir),
    git: (_slug, slugDir) => detectGitCodeInconsistency(slugDir),
  };
  const picked = only ? [[only, run[only]]].filter(([, fn]) => typeof fn === "function") : Object.entries(run);
  for (const slug of slugs) {
    const slugDir = join(root, slug);
    const treeDir = campaignTreeDir(root, slug);
    if (!treeDir) continue;
    for (const [, fn] of picked) findings.push(...fn(slug, slugDir, treeDir));
  }
  const counts = { floor: 0, ui: 0, skip: 0, claim: 0, git: 0 };
  for (const f of findings) counts[codeKey(f.code)] += 1;
  return { campaignRoot: root, slugs, seamError: error, findings, counts, ok: findings.length === 0 };
}

/** @param {string} code */
function codeKey(code) {
  if (code === FLOOR_CODE) return "floor";
  if (code === UI_CODE) return "ui";
  if (code === SKIP_CODE) return "skip";
  if (code === CLAIM_CODE) return "claim";
  if (code === GIT_CODE) return "git";
  return "other";
}

/** A console that ACTUALLY calls a real job export — the C1-02 mutation control. */
const WIRED_CONSOLE = `import * as generated from "../jobs/validate.ts";

export function Console() {
  const result = generated.validateBespokeEnquiry({
    senderName: "A",
    recipientName: "B",
    deliveryPostcode: "EC1A 1BB",
    deliveryDate: "2099-01-01",
    budgetRange: "50",
    occasion: "birthday",
    cardMessage: "hello",
  });
  return (<main><h1>{"Wired"}</h1><pre>{JSON.stringify(result)}</pre></main>);
}

export default Console;
`;

/** Create a temp dir for a scratch control; always removed. */
function scratch(fn) {
  const dir = mkdtempSync(join(tmpdir(), "rt-campaign-ctl-"));
  try {
    return fn(dir);
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
}

/** Copy an emitted tree into a scratch dir, never walking vendor/build/git. */
function copyTree(source, dest) {
  cpSync(source, dest, {
    recursive: true,
    filter: (src) => !/(^|[\\/])(node_modules|\.git|dist|build|coverage|\.output|\.vercel|\.next)$/.test(src),
  });
}

/**
 * The four mutation controls: each detector FIRES on its real campaign defect
 * and stays silent on an injected clean control (the negative proof that the
 * guard can fail). Returns `{ "<id>": {fired, controlClean, mutationRed} }`.
 * @param {string} root
 */
export async function campaignControls(root) {
  const { minimumTreeFileCount, treeSubstanceOf } = await loadCampaignSeams();
  const controls = {};
  const stockTree = campaignTreeDir(root, "office-stock-tracker");
  const flowerTree = campaignTreeDir(root, "flower-shop-website");
  const schedulerTree = campaignTreeDir(root, "office-scheduler");
  if (!stockTree || !flowerTree || !schedulerTree) throw new Error(`campaign trees unavailable under ${root}`);
  // C1-01: sealed below floor, no floor code (fires) vs the same seal carrying the code (silent).
  controls["C1-01"] = {
    fired: detectFloorReachability(join(root, "office-stock-tracker"), stockTree, minimumTreeFileCount).length > 0,
    controlClean: detectFloorReachability(join(root, "flower-shop-website"), flowerTree, minimumTreeFileCount).length === 0,
    mutationRed: scratch((d) => {
      const slugDir = join(d, "office-stock-tracker");
      copyTree(stockTree, join(slugDir, "emitted"));
      writeFileSync(join(slugDir, "emit.json"), JSON.stringify({ code: FLOOR_CODE }));
      return detectFloorReachability(slugDir, join(slugDir, "emitted"), minimumTreeFileCount).length === 0;
    }),
  };
  // C1-02: unwired console (fires) vs a console calling a real job export (silent).
  const uiMutation = scratch((d) => {
    const treeDir = join(d, "emitted");
    copyTree(flowerTree, treeDir);
    writeFileSync(join(treeDir, "src", "ui", "console.tsx"), WIRED_CONSOLE);
    return detectUiWiring(treeDir, treeSubstanceOf, "flower-shop-website").length === 0;
  });
  controls["C1-02"] = {
    fired: detectUiWiring(schedulerTree, treeSubstanceOf, "office-scheduler").length > 0,
    controlClean: uiMutation,
    mutationRed: uiMutation,
  };
  // C1-05: skip-dominated oracle (fires) vs a mostly-live spec (silent).
  const skipMutation = scratch((d) => {
    mkdirSync(join(d, "tests"), { recursive: true });
    writeFileSync(join(d, "tests", "oracle.spec.ts"), 'import { test } from "node:test";\ntest("a", () => {});\ntest("b", () => {});\ntest("c", () => {});\ntest.skip("d", () => {});\n');
    return detectSkipVacuity(d).length === 0;
  });
  controls["C1-05"] = {
    fired: detectSkipVacuity(schedulerTree, "office-scheduler").length > 0,
    controlClean: skipMutation,
    mutationRed: skipMutation,
  };
  // C1-06: a commit with no UI wiring (fires) vs one with uiWired:true (silent).
  const claimMutation = scratch((d) => {
    mkdirSync(join(d, "emitted"), { recursive: true });
    writeFileSync(join(d, "emit.json"), JSON.stringify({ ok: true, git: { committed: true }, treeRun: { ok: true, verdictHash: "abc" }, uiWired: true }));
    return detectUnverifiedClaim(d, join(d, "emitted")).length === 0;
  });
  controls["C1-06"] = {
    fired: detectUnverifiedClaim(join(root, "flower-shop-website"), flowerTree).length > 0,
    controlClean: claimMutation,
    mutationRed: claimMutation,
  };
  // C1-08: a withheld envelope whose git.code disagrees with the deciding
  // top-level code (fires) vs a committed envelope with no git code (silent);
  // the live seam is the CLI's withheld-envelope builder carrying `withheld.code`.
  const cliRe = /if\s*\(withheld\)\s*\{[\s\S]{0,900}?code:\s*withheld\.code/;
  const cli = safeRead(join(REPO_ROOT, "scripts", "rapidtool-cli.mjs"));
  controls["C1-08"] = {
    fired: detectGitCodeInconsistency(join(root, "office-stock-tracker")).length > 0,
    controlClean: detectGitCodeInconsistency(join(root, "flower-shop-website")).length === 0,
    wired: cliRe.test(cli),
    mutationRed: !cliRe.test(cli.replace("code: withheld.code", "code: payload.code")),
  };
  return controls;
}

/** Built-in control proofs consumed by `--selftest` and the P-A harness. */
export async function selftest() {
  const root = resolveCampaignRoot();
  if (!root) return { ok: false, entries: [], error: "no campaign root" };
  const controls = await campaignControls(root);
  const entries = Object.entries(controls).map(([id, c]) => ({ id, ...c }));
  return { ok: entries.every((e) => e.fired && e.controlClean && e.mutationRed), entries };
}

function usage(msg) {
  if (msg) console.error(`[campaign-invariants] ${msg}`);
  console.error("usage: node scripts/guards/campaign-invariants.mjs [--root <dir>] [--only floor|ui|skip|claim] [--json] [--selftest]");
}

async function main(argv) {
  const json = argv.includes("--json");
  const args = argv.filter((a) => a !== "--json");
  if (args.includes("--selftest")) {
    const r = await selftest();
    if (json) console.log(JSON.stringify({ guard: "campaign-invariants", selftest: r }, null, 2));
    else for (const e of r.entries) console.log(`[campaign-invariants] selftest ${e.id}: fired=${e.fired} controlClean=${e.controlClean}`);
    return r.ok ? 0 : 1;
  }
  const rootAt = args.indexOf("--root");
  const root = rootAt >= 0 ? resolve(args[rootAt + 1]) : resolveCampaignRoot();
  if (!root || !existsSync(root)) {
    usage("no campaign root (set RAPIDTOOL_CAMPAIGN_ROOT or run beside testruns/campaign1)");
    return 2;
  }
  const onlyAt = args.indexOf("--only");
  const only = onlyAt >= 0 ? args[onlyAt + 1] : null;
  const result = await scanCampaign(root, only);
  if (json) console.log(JSON.stringify({ guard: "campaign-invariants", ...result }, null, 2));
  else
    for (const f of result.findings) {
      const ff = /** @type {any} */ (f);
      console.log(`${ff.code} ${ff.slug}/${ff.tree ?? ff.envelope ?? ""}: ${ff.detail}`);
    }
  return result.ok ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`[campaign-invariants] ${String(e && e.message ? e.message : e)}`);
      process.exit(2);
    });
}
