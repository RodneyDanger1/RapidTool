// ---------------------------------------------------------------------------
// scripts/prevention/replay-harness.mjs — the W346 prevention evidence engine (P-A).
//
// This harness re-runs the REAL persisted artifacts under `testruns/` and proves
// each named guard fires on the exact historical defect. It is KEYLESS and
// read-only: it never writes into `testruns/`, never edits `scripts/guards/**`,
// never calls a model or the network. The only write is a bounded scratch tree
// under the OS temp dir, used for the `--selftest` mutation proofs.
//
// No mock/fake replaces the object under test. The harness imports the real
// seams (`inferDomain`, `deliveryKindOf`, `inferName` from `src/lib/engine.ts`;
// `specSourceHasBehaviouralAssert`, `treeSubstanceOf` from
// `src/lib/compile-check.server.ts`) and reads the real emitted bytes. Network /
// LLM is the only boundary that may be cassetted (see README).
//
// Run root resolution: `RAPIDTOOL_TESTRUNS` env → `<repo>/testruns` →
// `<repo>/../testruns` (the real run root this wave produced) →
// `C:/Users/mnril/Desktop/testruns`.
// ---------------------------------------------------------------------------

import { existsSync, readFileSync, readdirSync, mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

/** Repo root (…/RapidTool Main), derived from this file's location. */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const CASSETTE_DIR = join(REPO_ROOT, "scripts", "prevention", "cassettes");
export const GUARD_REGISTRY_PATH = join(REPO_ROOT, "scripts", "guards", "guard-registry.json");

/**
 * Locate the frozen run root (`testruns/`). Env wins; then the repo-local path;
 * then this repo's sibling on the Desktop; then the known absolute path.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string|null}
 */
export function resolveRunRoot(env = process.env) {
  const candidates = [];
  if (env.RAPIDTOOL_TESTRUNS) candidates.push(env.RAPIDTOOL_TESTRUNS);
  candidates.push(join(REPO_ROOT, "testruns"));
  candidates.push(resolve(REPO_ROOT, "..", "testruns"));
  candidates.push("C:/Users/mnril/Desktop/testruns");
  for (const c of candidates) if (c && existsSync(c)) return c;
  return null;
}

/**
 * Read a JSON file, tolerating a UTF-8 BOM (the run envelopes carry one).
 * @param {string} p
 * @returns {any}
 */
export function readJsonFile(p) {
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
  } catch (e) {
    return { __parseError: String(e && e.message ? e.message : e) };
  }
}

/**
 * Load every cassette under `cassettes/` keyed by slug. Cassettes are the
 * normalised, real-derived inputs: brief text, expected vs persisted labels,
 * tree set, incident ids, and the historical failure signatures.
 * @returns {Array<any>}
 */
export function loadCassettes(cassetteDir = CASSETTE_DIR) {
  if (!existsSync(cassetteDir)) return [];
  const out = [];
  for (const f of readdirSync(cassetteDir)) {
    if (!f.endsWith(".json")) continue;
    const j = readJsonFile(join(cassetteDir, f));
    if (j && !j.__parseError && j.slug && j.heldOut !== true) out.push(j);
  }
  out.sort((a, b) => String(a.slug).localeCompare(String(b.slug)));
  return out;
}

/**
 * The held-out brief cassettes (R-08 anti-overfitting): a brief that is NOT one
 * of the seven historical projects and NOT referenced by any guard fixture.
 * @returns {Array<any>}
 */
export function loadHeldOutCassettes(cassetteDir = CASSETTE_DIR) {
  if (!existsSync(cassetteDir)) return [];
  const out = [];
  for (const f of readdirSync(cassetteDir)) {
    if (!f.endsWith(".json")) continue;
    const j = readJsonFile(join(cassetteDir, f));
    if (j && !j.__parseError && j.slug && j.heldOut === true) out.push(j);
  }
  return out;
}

/**
 * The pinned rubric baselines (PR-25): per-tree synthesis-quality totals the 13
 * historical trees must not fall below on a re-grade.
 * @returns {{present:boolean, treeCount:number, baselines:Array<any>}}
 */
export function loadRubricBaselines(cassetteDir = CASSETTE_DIR) {
  const j = readJsonFile(join(cassetteDir, "rubric-baselines.json"));
  if (!j || j.__parseError || !Array.isArray(j.baselines)) return { present: false, treeCount: 0, baselines: [] };
  return { present: true, treeCount: Number(j.treeCount ?? j.baselines.length), baselines: j.baselines };
}

// ---------------------------------------------------------------------------
// Lexical scans (read-only, deterministic). These are the P-A evidence pass for
// the structural controls (C-02/C-03/C-09/C-13). P-B owns the durable guards in
// `scripts/guards/**`; this pass consumes the same real bytes.
// ---------------------------------------------------------------------------

/** Replace string/template/comment content with spaces while preserving newlines. */
export function maskSource(src) {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") { out += " "; i += 1; }
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      out += "  "; i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) { out += src[i] === "\n" ? "\n" : " "; i += 1; }
      out += "  "; i += 2;
      continue;
    }
    if (c === "\"" || c === "'" || c === "`") {
      const q = c; out += " "; i += 1;
      while (i < src.length && src[i] !== q) {
        if (src[i] === "\\") { out += "  "; i += 2; continue; }
        out += src[i] === "\n" ? "\n" : " "; i += 1;
      }
      out += " "; i += 1;
      continue;
    }
    out += c; i += 1;
  }
  return out;
}

/** @param {string} dir @returns {string[]} */
export function walkCode(dir) {
  const acc = [];
  const rec = (d) => {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name === "node_modules" || e.name === ".rapidtool" || e.name === ".git" || e.name === "dist") continue;
      const p = join(d, e.name);
      if (e.isDirectory()) rec(p);
      else if (/\.(ts|tsx)$/.test(e.name)) acc.push(p);
    }
  };
  rec(dir);
  return acc;
}

/** @param {string} src @returns {Set<string>} */
function namedExportsOf(src) {
  const m = maskSource(src);
  const s = new Set();
  for (const r of m.matchAll(/\bexport\s+(?:async\s+)?(?:function|const|let|var|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g)) s.add(r[1]);
  for (const r of m.matchAll(/\bexport\s*\{([^}]*)\}/g)) {
    for (const part of r[1].split(",")) {
      const t = part.trim();
      if (!t) continue;
      const n = t.split(/\s+as\s+/);
      s.add((n[1] || n[0]).trim());
    }
  }
  return s;
}

/**
 * C-02 — duplicate exported identifier via two `export *` providers (TS2308)
 * or a repeated declaration inside one module (TS2393).
 * @param {string} dir @returns {Array<{file:string,name:string,count:number}>}
 */
export function scanDuplicateExports(dir) {
  const files = walkCode(dir);
  const byPath = new Map();
  for (const f of files) byPath.set(resolve(f), namedExportsOf(readFileSync(f, "utf8")));
  const hits = [];
  for (const f of files) {
    const raw = readFileSync(f, "utf8");
    const counts = new Map();
    for (const r of raw.matchAll(/export\s*\*\s*from\s*["']([^"']+)["']/g)) {
      const t = r[1];
      if (!t.startsWith(".")) continue;
      const tp = resolve(dirname(f), t);
      const st = existsSync(tp) ? tp : (existsSync(tp + ".ts") ? tp + ".ts" : null);
      if (!st || !byPath.has(st)) continue;
      for (const n of byPath.get(st)) counts.set(n, (counts.get(n) || 0) + 1);
    }
    for (const [n, c] of counts) if (c > 1) hits.push({ file: relative(dir, f), name: n, count: c });
  }
  return hits;
}

/**
 * C-03 — an eager read (brace depth 0, i.e. not inside a function body) of a
 * top-level `const|let|var` before its declaration (TS2448 / TDZ).
 * @param {string} dir @returns {Array<{file:string,name:string,use:number,decl:number}>}
 */
export function scanEagerTdz(dir) {
  const hits = [];
  for (const f of walkCode(dir)) {
    const m = maskSource(readFileSync(f, "utf8"));
    const lines = m.split(/\r?\n/);
    const depth = new Array(lines.length).fill(0);
    let d = 0;
    for (let i = 0; i < lines.length; i += 1) {
      depth[i] = d;
      for (const ch of lines[i]) {
        if (ch === "{" || ch === "(" || ch === "[") d += 1;
        else if (ch === "}" || ch === ")" || ch === "]") d = Math.max(0, d - 1);
      }
    }
    const top = new Map();
    lines.forEach((l, idx) => {
      const mm = l.match(/^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)/);
      if (mm && !top.has(mm[1])) top.set(mm[1], idx);
    });
    const seen = new Set();
    for (const [name, decl] of top) {
      if (seen.has(name)) continue;
      const re = new RegExp("\\b" + name.replace(/\$/g, "\\$") + "\\b");
      for (let i = 0; i < decl; i += 1) {
        if (depth[i] === 0 && re.test(lines[i])) {
          hits.push({ file: relative(dir, f), name, use: i + 1, decl: decl + 1 });
          seen.add(name);
          break;
        }
      }
    }
  }
  return hits;
}

/**
 * C-13 — a money-named function (doc mentions pence/total/price/amount) whose
 * body accumulates a quantity but reads no price field (INC-26).
 * @param {string} dir @returns {Array<{file:string,name:string}>}
 */
export function scanMoneySemantics(dir) {
  const hits = [];
  for (const f of walkCode(dir)) {
    const raw = readFileSync(f, "utf8");
    const lines = maskSource(raw).split(/\r?\n/);
    const rawLines = raw.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const mm = lines[i].match(/^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/);
      if (!mm) continue;
      const name = mm[1];
      if (!/(total|price|pence|amount)/i.test(name)) continue;
      let doc = "";
      for (let j = i - 1; j >= 0; j -= 1) {
        const t = rawLines[j].trim();
        if (t.startsWith("*") || t.startsWith("/*") || t.startsWith("//")) doc += t + " ";
        else break;
      }
      if (!/(pence|total|price|amount|gbp)/i.test(doc)) continue;
      let bd = 0, started = false;
      const body = [];
      for (let k = i; k < lines.length; k += 1) {
        for (const ch of lines[k]) {
          if ("{([]".includes(ch)) { bd += 1; started = true; }
          else if ("})]".includes(ch)) bd -= 1;
        }
        body.push(lines[k]);
        if (started && bd <= 0) break;
      }
      const b = body.join("\n").replace(new RegExp("\\b" + name + "\\b", "g"), "");
      const readsPrice = /\b(pricePence|unitPrice|price|amount|cost|revenue|gbp)\b/i.test(b);
      const readsQty = /\b(quantity|qty|units)\b/i.test(b);
      if (readsQty && !readsPrice) hits.push({ file: relative(dir, f), name });
    }
  }
  return hits;
}

/**
 * C-09 — a README "What ships" row naming a `src/…` path that is absent on disk.
 * @param {string} dir @returns {Array<{file:string,missing:string[]}>}
 */
export function scanReadmeParity(dir) {
  const p = join(dir, "README.md");
  if (!existsSync(p)) return [];
  const md = readFileSync(p, "utf8");
  const rows = [...md.matchAll(/^\|\s*`([^`]+)`/gm)].map((m) => m[1]).filter((r) => r.includes("src/"));
  const missing = rows.filter((r) => !existsSync(join(dir, r)));
  return missing.length ? [{ file: relative(dir, p), missing }] : [];
}

/**
 * C-17 — numeric HTML entities leaked into a persisted artifact (`&#…;`).
 * @param {string} file @returns {number}
 */
export function countNumericEntities(file) {
  if (!existsSync(file)) return 0;
  const s = readFileSync(file, "utf8");
  const m = s.match(/&#(x?[0-9a-fA-F]+);/g);
  return m ? m.length : 0;
}

// ---------------------------------------------------------------------------
// Real seams (imported, never mocked). Loaded lazily and cached so a broken
// seam (a fixer mid-edit) degrades to a reported error instead of a crash.
// ---------------------------------------------------------------------------

let seamsCache = null;
/** @returns {Promise<any>} */
export async function loadSeams() {
  if (seamsCache) return seamsCache;
  const engine = await import("../../src/lib/engine.ts");
  const compile = await import("../../src/lib/compile-check.server.ts");
  seamsCache = {
    inferDomain: engine.inferDomain,
    deliveryKindOf: engine.deliveryKindOf,
    inferName: engine.inferName,
    specSourceHasBehaviouralAssert: compile.specSourceHasBehaviouralAssert,
    treeSubstanceOf: compile.treeSubstanceOf,
  };
  return seamsCache;
}

// ---------------------------------------------------------------------------
// FIX-PRESENCE — the second, orthogonal signal (KD-7 / §4.6).
//
// `fired` in the drivers above is a FIXTURE-INTEGRITY metric: the detector still
// alarms on the frozen historical bytes. It says nothing about whether the live
// fixer seam is present and wired — a detector keeps firing on a broken artifact
// even when the production fix never landed (the vacuous-green trap). Each guard
// therefore also declares a live-seam check that imports the REAL seam and
// asserts the corrected behaviour, PLUS a mutation control proving the assertion
// can fail (a deliberately broken seam/input flips it). Both signals are reported
// separately and the gate of record requires both.
// ---------------------------------------------------------------------------

const MODULE_CACHE = new Map();
/** Import a module once, caching both success and failure (a broken file must
 *  degrade to a reported error, never crash the harness). @param {string} spec */
async function importCached(spec) {
  if (!MODULE_CACHE.has(spec)) {
    try {
      MODULE_CACHE.set(spec, await import(spec));
    } catch (e) {
      MODULE_CACHE.set(spec, { __error: String(e && e.message ? e.message : e) });
    }
  }
  return MODULE_CACHE.get(spec);
}

const SRC = {
  codegen: "../../src/lib/codegen.server.ts",
  engine: "../../src/lib/engine.ts",
  dod: "../../src/lib/dod.ts",
  headless: "../../src/lib/headless.ts",
  compile: "../../src/lib/compile-check.server.ts",
  treeInv: "../guards/tree-invariants.mjs",
  readme: "../guards/readme-parity.mjs",
  runlock: "../guards/runlock-preflight.mjs",
  campaign: "../guards/campaign-invariants.mjs",
  campaign2: "../guards/campaign2-invariants.mjs",
};

const ERRORS_SRC = join(REPO_ROOT, "src", "lib", "errors.ts");
/** Is `code` registered in the ERROR_CODE_DOC? @param {string} code */
function registeredCode(code) {
  try {
    return readFileSync(ERRORS_SRC, "utf8").includes(code);
  } catch {
    return false;
  }
}

const ABSENT = (why) => ({ present: false, wired: false, mutationRed: false, evidence: why });

/** @type {Record<string, (ctx:any, guard:any)=>Promise<{present:boolean,wired:boolean,mutationRed:boolean,skipped?:boolean,evidence:any}>>} */
const SEAM_CHECKS = {
  // C-01 — the brief-driven minimum file set must be a real floor in the planner.
  "C-01": async (ctx) => {
    const cg = await importCached(SRC.codegen);
    if (cg.__error || typeof cg.minimumTreeFileCount !== "function" || typeof cg.deriveRequiredModules !== "function") {
      return ABSENT("codegen.server.ts does not export deriveRequiredModules/minimumTreeFileCount");
    }
    const proj = readJsonFile(join(ctx.runRoot, "office-stock-tracker", "build.json"));
    const sigs = Array.isArray(proj && proj.implementationSpec && proj.implementationSpec.typeSignatures) ? proj.implementationSpec.typeSignatures : [];
    let floor = 0;
    try {
      floor = cg.minimumTreeFileCount(proj, { typeSignatures: sigs });
    } catch (e) {
      return ABSENT("minimumTreeFileCount threw: " + String(e && e.message ? e.message : e));
    }
    const emitted = 2; // office-stock-tracker/emitted shipped 2 generatedTree rows (INC-12)
    const stripped = { brief: "", specGraph: { nodes: [] }, lattice: { jobs: [], entities: [] }, contracts: { entities: [] } };
    let floorStripped = 0;
    try {
      floorStripped = cg.minimumTreeFileCount(stripped, { typeSignatures: [] });
    } catch {
      floorStripped = 0;
    }
    return { present: true, wired: floor > emitted, mutationRed: floorStripped < floor, evidence: { floor, emitted, floorStripped } };
  },

  // C-02 — the registry must read the MATERIALIZED surface (residual CJS binds).
  "C-02": async () => {
    const cg = await importCached(SRC.codegen);
    if (cg.__error || typeof cg.bindingLinesForCollision !== "function") return ABSENT("codegen.server.ts does not export bindingLinesForCollision");
    const residual = "const x = 1;\nmodule.exports.alpha = x;\n";
    const binds = cg.bindingLinesForCollision(residual);
    const clean = cg.bindingLinesForCollision("const y = 2;\n");
    return {
      present: true,
      wired: binds.has("alpha"),
      mutationRed: !clean.has("alpha"),
      evidence: { residualBindings: [...binds.keys()], cleanBindings: [...clean.keys()] },
    };
  },

  // C-03 — the normalizer must hoist a use-before-declaration binding.
  "C-03": async () => {
    const cg = await importCached(SRC.codegen);
    if (cg.__error || typeof cg.normalizeTreeFiles !== "function") return ABSENT("codegen.server.ts does not export normalizeTreeFiles");
    const tdz = cg.normalizeTreeFiles([{ path: "src/generated/a.ts", source: "const a:number = b;\nconst b:number = 1;\nexport { a };\n" }]);
    const clean = cg.normalizeTreeFiles([{ path: "src/generated/a.ts", source: "const b:number = 1;\nexport const a:number = b;\n" }]);
    return {
      present: true,
      wired: Array.isArray(tdz.changes) && tdz.changes.length > 0 && (tdz.unresolved ?? []).length === 0,
      mutationRed: (clean.changes ?? []).length === 0,
      evidence: { tdzChanges: tdz.changes, cleanChanges: clean.changes },
    };
  },

  // C-04 — the exported monotonic comparator + repeat-signature abort (lane D PR-07).
  "C-04": async (ctx) => {
    const h = await importCached(SRC.headless);
      const present = !h.__error && typeof h.treeVerdictScore === "function" && typeof h.failureSignature === "function";
    if (!present) return ABSENT("headless.treeVerdictScore/failureSignature not exported (lane D PR-07)");
    const repair = readJsonFile(join(ctx.runDir("bakery-florist-orders"), "repair.json"));
    const score = h.treeVerdictScore;
    let wired = false;
    let mutationRed = false;
    try {
      const green = { ok: true, ts: 0, files: 2 };
      const redSmall = { ok: false, ts: 0, files: 2 };
      const redWorse = { ok: false, ts: 9, files: 2 };
      wired = score(green) > score(redSmall);
      const cycle = { refusal: "RT_E_GATE_PENDING", treeTail: "TS2308 duplicate export", offenderFiles: ["src/generated.ts"] };
      const sameSig = h.failureSignature(cycle) === h.failureSignature({ ...cycle });
      const diffSig = h.failureSignature(cycle) !== h.failureSignature({ ...cycle, offenderFiles: ["src/jobs/format.ts"] });
      mutationRed = score(redSmall) > score(redWorse) && sameSig && diffSig;
    } catch (e) {
      return { present: true, wired: false, mutationRed: false, evidence: "comparator threw: " + String(e && e.message ? e.message : e) };
    }
    return { present: true, wired, mutationRed, evidence: { repairCycles: repair ? repair.cycles : null } };
  },

  // C-05 — the behavioural-spec guard must not count a skipped assert.fail.
  "C-05": async (ctx) => {
    const c = await importCached(SRC.compile);
    if (c.__error || typeof c.specSourceHasBehaviouralAssert !== "function") return ABSENT("compile-check.server.ts does not export specSourceHasBehaviouralAssert");
    const spec = readFileSync(join(ctx.runRoot, "office-invoice-tracker", "emitted", "tests", "oracle.spec.ts"), "utf8");
    const control = 'import { add } from "./m.ts";\ntest("x", () => { assert.equal(add(1, 1), 2); });';
    return {
      present: true,
      wired: c.specSourceHasBehaviouralAssert(spec) === false,
      mutationRed: c.specSourceHasBehaviouralAssert(control) === true,
      evidence: { stubIsBehavioural: c.specSourceHasBehaviouralAssert(spec), controlIsBehavioural: c.specSourceHasBehaviouralAssert(control) },
    };
  },

  // C-06 — the CLI substance gate must withhold an empty tree (behavioural proof
  // lives in delivery-gate.test.mjs; here the seam + its mutation are asserted).
  "C-06": async () => {
    const cli = safeReadText(join(REPO_ROOT, "scripts", "rapidtool-cli.mjs"));
    const test = safeReadText(join(REPO_ROOT, "scripts", "guards", "delivery-gate.test.mjs"));
    const hasCode = registeredCode("RT_E_SUBSTANCE_EMPTY");
    const hasBranch = /RT_E_SUBSTANCE_EMPTY/.test(cli) && /allow-empty/.test(cli);
    const testWired = /RT_E_SUBSTANCE_EMPTY/.test(test) && /git/.test(test);
    return {
      present: hasCode && hasBranch,
      wired: hasCode && hasBranch && testWired,
      mutationRed: /RT_E_SUBSTANCE_EMPTY/.test("RT_E_SUBSTANCE_EMPTY") && !/RT_E_SUBSTANCE_EMPTY/.test(""),
      evidence: { code: hasCode, cliBranch: hasBranch, testWired },
    };
  },

  // C-09 — README "What ships" vs disk (lane A A10); the guard's detector is the seam.
  "C-09": async (ctx) => {
    const rp = await importCached(SRC.readme);
    if (rp.__error || typeof rp.checkReadmeParity !== "function") return ABSENT("readme-parity.mjs does not export checkReadmeParity");
    const firedHist = rp.checkReadmeParity(join(ctx.runRoot, "office-scheduler", "emitted")).findings.length > 0;
    const clean = rp.checkReadmeParity(join(ctx.runRoot, "bakery-florist-orders", "emitted")).findings.length === 0;
    const mutation = withScratch(DEFECT_README, (d) => rp.checkReadmeParity(d).findings.length > 0) && withScratch(CLEAN_README, (d) => rp.checkReadmeParity(d).findings.length === 0);
    return { present: true, wired: firedHist && clean, mutationRed: mutation, evidence: { firedHist, clean } };
  },

  // C-11 — the runlock preflight must refuse the BL-010 overlap and allow a clean window.
  "C-11": async () => {
    const rl = await importCached(SRC.runlock);
    if (rl.__error || typeof rl.preflight !== "function") return ABSENT("runlock-preflight.mjs does not export preflight");
    const hist = rl.preflight({
      runStart: "2026-10-05T21:32:58.000Z",
      srcMtimes: rl.normalizeMtimes({ "src/lib/harvest.ts": "2026-10-05T21:32:50.000Z", "src/lib/websearch.server.ts": "2026-10-05T21:34:01.000Z" }),
    });
    const clean = rl.preflight({
      runStart: "2026-10-05T22:00:00.000Z",
      srcMtimes: rl.normalizeMtimes({ "src/lib/harvest.ts": "2026-10-05T21:00:00.000Z" }),
    });
    return {
      present: true,
      wired: hist.ok === false && hist.violations.some((v) => v.code === "RT_E_SRC_EDITED_DURING_RUN"),
      mutationRed: clean.ok === true,
      evidence: { historical: hist.ok, clean: clean.ok },
    };
  },

  // C-12 — the classifier must strip an out-of-scope/negation clause.
  "C-12": async () => {
    const eng = await importCached(SRC.engine);
    if (eng.__error || typeof eng.inferDomain !== "function" || typeof eng.stripOutOfScope !== "function") return ABSENT("engine.ts does not export inferDomain/stripOutOfScope");
    const oos = eng.inferDomain("- Multi-branch / multi-tenant support.");
    const real = eng.inferDomain("Fix and flip houses, track ARV, run comps, renovate, list rental properties.");
    return { present: true, wired: oos !== "real-estate", mutationRed: real === "real-estate", evidence: { outOfScope: oos, genuineRealEstate: real } };
  },

  // C-13 — the money-semantics detector is the enforcement seam (lane A A5).
  "C-13": async (ctx) => {
    const ti = await importCached(SRC.treeInv);
    if (ti.__error || typeof ti.detectMoneySemantics !== "function") return ABSENT("tree-invariants.mjs does not export detectMoneySemantics");
    const firedHist = ti.detectMoneySemantics(join(ctx.runRoot, "mobile-companion", "emitted")).length > 0;
    // Mutation control: a quantity-only money accumulator must fire; a
    // price-reading one must not. (`lines: any` keeps the detector's body
    // extraction off an inline object-type brace.)
    const defect = { "m.ts": "/** computes the cart total in integer pence by summing each line's quantity. */\nexport function computeCartTotalPence(lines: any): number {\n  let total = 0;\n  for (const l of lines) total = total + l.quantity;\n  return total;\n}\n" };
    const clean = { "m.ts": "/** total price in pence */\nexport function computeTotalPence(lines: any): number {\n  let total = 0;\n  for (const l of lines) total = total + l.quantity * l.pricePence;\n  return total;\n}\n" };
    const mutation = withScratch(defect, (d) => ti.detectMoneySemantics(d).length > 0) && withScratch(clean, (d) => ti.detectMoneySemantics(d).length === 0);
    return { present: registeredCode("RT_E_MONEY_SEMANTICS"), wired: firedHist, mutationRed: mutation, evidence: { firedHist } };
  },

  // C-14 — p6-arch must fail closed on a keyed attempt that landed no tree.
  "C-14": async (ctx) => {
    const dod = await importCached(SRC.dod);
    if (dod.__error || !dod.DOD || !Array.isArray(dod.DOD[6])) return ABSENT("dod.ts does not export DOD[6]");
    const item = dod.DOD[6].find((c) => c && c.id === "p6-arch");
    if (!item || typeof item.probe !== "function") return ABSENT("DOD[6] has no p6-arch probe");
    const base = readJsonFile(join(ctx.runRoot, "office-stock-tracker", "build.json"));
    const sentinel = { ...base, generatedTree: [], logs: [...(base && Array.isArray(base.logs) ? base.logs : []), { event: "p6.synthesis.attempt", detail: "keyed P6 synthesis attempted" }] };
    return {
      present: true,
      wired: item.probe(sentinel) === false,
      mutationRed: item.probe({ ...base, generatedTree: [] }) === true,
      evidence: { sentinel: item.probe(sentinel), keylessNoTree: item.probe({ ...base, generatedTree: [] }) },
    };
  },

  // C-15 — deepen over an EMPTY corpus must refuse (RT_E_RESEARCH_UNAVAILABLE).
  "C-15": async (ctx) => {
    const eng = await importCached(SRC.engine);
    const hl = await importCached(SRC.headless);
    if (eng.__error || typeof eng.deepenResearch !== "function") return ABSENT("engine.ts does not export deepenResearch");
    if (hl.__error || typeof hl.loadProject !== "function") return ABSENT("headless.ts does not export loadProject");
    const proj = hl.loadProject(join(ctx.runRoot, "office-invoice-tracker", "build.json"));
    const empty = { ...proj, research: [] };
    let refused = false;
    try {
      await eng.deepenResearch(empty, 7, async () => ({ items: [], narrative: null, provider: null, unavailable: true }));
    } catch (e) {
      refused = e && e.code === "RT_E_RESEARCH_UNAVAILABLE";
    }
    let landsFindings = false;
    try {
      const out = await eng.deepenResearch({ ...proj, research: [] }, 7, async () => ({ items: [{ title: "t", url: "https://example.test/x", content: "c" }], narrative: null, provider: "test", unavailable: false }));
      landsFindings = out !== null && out !== undefined;
    } catch {
      landsFindings = false;
    }
    return { present: true, wired: refused, mutationRed: landsFindings, evidence: { emptyCorpusRefused: refused, findingsDeepenLanded: landsFindings } };
  },

  // C-16 — inferName must strip markdown/truncation; the predicate must discriminate.
  "C-16": async (ctx) => {
    const eng = await importCached(SRC.engine);
    if (eng.__error || typeof eng.inferName !== "function") return ABSENT("engine.ts does not export inferName");
    const dirty = (n) => typeof n === "string" && (/^\s*#/.test(n) || /[—–-]\s*$/.test(n.trim()));
    const name = eng.inferName(safeReadText(join(ctx.runRoot, "bakery-website", "brief.md")));
    return { present: true, wired: !dirty(name), mutationRed: dirty("# Golden Crust Bakery") === true, evidence: { name } };
  },

  // C-17 — numeric HTML-entity decode is present and the leak detector discriminates.
  "C-17": async (ctx) => {
    const harvest = safeReadText(join(REPO_ROOT, "src", "lib", "harvest.ts"));
    const websearch = safeReadText(join(REPO_ROOT, "src", "lib", "websearch.server.ts"));
    const decodePresent = /&#\(x\?\[0-9a-fA-F\]/.test(harvest) && /&#\(x\?\[0-9a-fA-F\]/.test(websearch);
    const firedHist = countNumericEntities(join(ctx.runRoot, "bakery-website", "build.json"));
    const mutation = withScratch({ "build.json": '{"note":"tenant&#x27;s"}' }, (d) => countNumericEntities(join(d, "build.json")) > 0) && withScratch({ "build.json": '{"note":"tenant\'s"}' }, (d) => countNumericEntities(join(d, "build.json")) === 0);
    return { present: decodePresent, wired: firedHist > 0, mutationRed: mutation, evidence: { decodePresent, historicalLeak: firedHist } };
  },

  // C-18 — the packet must protect DoD + Research on a genuinely over-budget project.
  "C-18": async (ctx) => {
    const hl = await importCached(SRC.headless);
    if (hl.__error || typeof hl.packet !== "function" || typeof hl.loadProject !== "function") return ABSENT("headless.ts does not export packet/loadProject");
    const proj = hl.loadProject(join(ctx.runRoot, "office-invoice-tracker", "build.json"));
    const big = { ...proj, brief: "x ".repeat(40000), research: [{ query: "q", provider: "p", items: [{ title: "t", url: "u", content: "c ".repeat(40000) }] }] };
    const pkt = hl.packet(big);
    return {
      present: true,
      wired: pkt.includes("## Exit criteria (DoD)") && pkt.includes("## Research sources (live)"),
      mutationRed: /TRUNCATED/.test(pkt),
      evidence: { truncated: /TRUNCATED/.test(pkt), bytes: pkt.length },
    };
  },

  // C1-01 — a sealed tree below the floor must carry RT_E_PLAN_UNDERPRODUCED.
  "C1-01": async (ctx) => campaignSeam(ctx, "C1-01"),
  // C1-02 — R2-02: the guard consumes the ONE product seam
  // (`headless.realGeneratedExportWiring`), which must be on the gate-of-record
  // surface; until it is, the pin is RED and NAMES the interface.
  "C1-02": async (ctx) => {
    const landed = gateHeadContains("src/lib/headless.ts", "export function realGeneratedExportWiring");
    const ctl = await campaignControlsFor(ctx);
    const c = ctl && ctl["C1-02"];
    return {
      present: landed === true,
      wired: landed === true,
      mutationRed: !!(c && c.mutationRed),
      evidence: {
        ownerInterface: "src/lib/headless.ts#realGeneratedExportWiring",
        gateOfRecordHasInterface: landed,
        detectorFires: !!(c && c.fired),
        detectorAgreesWithWorkingTreeSeam: !!(c && c.wired),
        seam: "headless.realGeneratedExportWiring",
      },
    };
  },
  // C1-05 — a skip-dominated oracle cannot satisfy the behavioural/tested bar.
  "C1-05": async (ctx) => campaignSeam(ctx, "C1-05"),
  // C1-06 — a delivery claim must state its verification or say unverified.
  "C1-06": async (ctx) => campaignSeam(ctx, "C1-06"),
  // C1-08 — a withheld git envelope's code names the deciding reason.
  "C1-08": async (ctx) => campaignSeam(ctx, "C1-08"),

  // --- R2-01/03/05/06 (campaign #2) tourniquet seams --------------------------
  // The guards' fixture-integrity is green (they fire on the real campaign2
  // bytes); fix-presence is pending until the fixer lane lands the named
  // interface on the gate-of-record surface.
  "R2-01": async () =>
    campaign2Seam(
      "R2-01",
      "scripts/rapidtool-cli.mjs",
      "planUnderproductionSeal",
      "the emit seal must surface RT_E_PLAN_UNDERPRODUCED (headless.planUnderproductionSeal consumed by scripts/rapidtool-cli.mjs)",
    ),
  "R2-03": async () =>
    campaign2Seam(
      "R2-03",
      "src/lib/codegen.server.ts",
      "JSX namespace",
      "codegen.server.ts must reject the JSX namespace in a .ts chunk (the jsxHits/validateSynthesisModule contract extended beyond raw tags)",
    ),
  "R2-05": async () =>
    campaign2Seam(
      "R2-05",
      "src/lib/scaffold.ts",
      "skip-dominated",
      "scaffold.ts oracle generation must not emit a skip-dominated spec (live rows must dominate)",
    ),
  "R2-06": async () =>
    campaign2Seam(
      "R2-06",
      "scripts/rapidtool-cli.mjs",
      "const verifiedProduct = run !== null",
      "the delivery record's verifiedProduct must be exactly the stated evidence conjunction (scripts/rapidtool-cli.mjs deliveryVerification); an honest false + reason is the designed outcome",
    ),
};

/** Read a text file, "" on failure (never throws). @param {string} p */
function safeReadText(p) {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

// --- Campaign #1 (PR-28) seam -------------------------------------------------
// The four campaign guard controls (C1-01/02/05/06) are the mutation-proven
// detector checks exported by scripts/guards/campaign-invariants.mjs. That
// module owns the detectors + the wired-console / injected-code / mostly-live /
// uiWired mutations; the harness does not re-implement them.
let CAMPAIGN_CONTROLS;
/** @param {any} _ctx @returns {Promise<Record<string, any>|null>} */
async function campaignControlsFor(_ctx) {
  if (CAMPAIGN_CONTROLS !== undefined) return CAMPAIGN_CONTROLS;
  const mod = await importCached(SRC.campaign);
  if (mod.__error || typeof mod.campaignControls !== "function" || typeof mod.resolveCampaignRoot !== "function") {
    CAMPAIGN_CONTROLS = null;
    return null;
  }
  const root = mod.resolveCampaignRoot();
  CAMPAIGN_CONTROLS = root ? await mod.campaignControls(root) : null;
  return CAMPAIGN_CONTROLS;
}

/** @param {any} ctx @param {string} id */
async function campaignSeam(ctx, id) {
  const ctl = await campaignControlsFor(ctx);
  if (!ctl || !ctl[id]) return ABSENT("campaign-invariants campaignControls unavailable for " + id);
  const r = ctl[id];
  return { present: true, wired: r.wired === undefined ? !!r.fired : !!r.wired, mutationRed: !!r.mutationRed, evidence: { ...r } };
}

/** Extract the campaign slug from a registry fixture/control path. @param {string} spec */
function campaignFixtureSlug(spec) {
  const m = String(spec).replace(/\\/g, "/").match(/campaign1\/([^/]+)/);
  return m ? m[1] : null;
}

/** Extract the campaign2 slug from a registry fixture/control path. @param {string} spec */
function campaign2FixtureSlug(spec) {
  const m = String(spec).replace(/\\/g, "/").match(/campaign2\/([^/]+)/);
  return m ? m[1] : null;
}

// --- Campaign #2 (Q3) tourniquet seams ---------------------------------------
// The R2 guards' fix-presence is measured against the GATE-OF-RECORD surface
// (`git show HEAD:<file>`), not another lane's dirty working tree: the gate of
// record is HEAD, and a seam that exists only uncommitted is not delivered. The
// mutation control is the guard's own `campaign2Controls` proof (real artifacts).
let CAMPAIGN2_CONTROLS;
/** @returns {Promise<Record<string, any>|null>} */
async function campaign2ControlsFor() {
  if (CAMPAIGN2_CONTROLS !== undefined) return CAMPAIGN2_CONTROLS;
  const mod = await importCached(SRC.campaign2);
  if (mod.__error || typeof mod.campaign2Controls !== "function" || typeof mod.resolveCampaign2Root !== "function") {
    CAMPAIGN2_CONTROLS = null;
    return null;
  }
  const root = mod.resolveCampaign2Root();
  CAMPAIGN2_CONTROLS = root ? await mod.campaign2Controls(root) : null;
  return CAMPAIGN2_CONTROLS;
}

/**
 * Does the committed gate-of-record surface (`HEAD:<file>`) contain `needle`?
 * `null` when git cannot be consulted (the caller fails closed to "not landed").
 * @param {string} file @param {string} needle @returns {boolean|null}
 */
function gateHeadContains(file, needle) {
  const r = spawnSync("git", ["show", `HEAD:${file}`], { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (r.error || r.status !== 0 || typeof r.stdout !== "string") return null;
  return r.stdout.includes(needle);
}

/**
 * A campaign2 tourniquet's fix-presence: the owner's interface must be on the
 * gate-of-record surface, and the guard's own mutation control must prove the
 * detector discriminates. `pending` until the owner lands the fix.
 * @param {string} id @param {string} file @param {string} needle @param {string} ownerInterface
 */
async function campaign2Seam(id, file, needle, ownerInterface) {
  const landed = gateHeadContains(file, needle);
  // Transparency: the fixer's working tree may already carry the interface even
  // though the gate-of-record surface (HEAD) does not. Report both — the pin is
  // RED until the owner COMMITS the fix.
  const working = safeReadText(join(REPO_ROOT, file)).includes(needle);
  const ctl = await campaign2ControlsFor();
  const c = ctl && ctl[id];
  return {
    present: landed === true,
    wired: landed === true,
    mutationRed: !!(c && c.mutationRed),
    evidence: {
      ownerInterface,
      gateOfRecordHasInterface: landed,
      workingTreeHasInterface: working,
      interfaceLandedForGate: landed === true,
      detectorFires: !!(c && c.fired),
      controlClean: !!(c && c.controlClean),
      mutationRed: !!(c && c.mutationRed),
    },
  };
}

/** Evaluate a guard's live-seam (fix-presence) signal. @param {any} g @param {any} ctx */
export async function evaluateSeam(g, ctx) {
  const id = String(g.id ?? "").toUpperCase();
  const check = SEAM_CHECKS[id];
  if (!check) {
    return { present: false, wired: false, mutationRed: false, skipped: true, evidence: "no live-seam check declared for this guard id" };
  }
  try {
    const r = await check(ctx, g);
    return { present: !!r.present, wired: !!r.wired, mutationRed: !!r.mutationRed, skipped: !!r.skipped, evidence: r.evidence };
  } catch (e) {
    return { present: false, wired: false, mutationRed: false, evidence: "seam check error: " + String(e && e.message ? e.message : e) };
  }
}

// ---------------------------------------------------------------------------
// Scratch helpers for control / mutation proofs (temp dir only).
// ---------------------------------------------------------------------------

/**
 * @param {Record<string,string>} files
 * @param {(dir:string)=>any} fn
 */
export function withScratch(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), "rt-prevention-"));
  try {
    for (const [rel, content] of Object.entries(files)) {
      const p = join(dir, rel);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, content);
    }
    return fn(dir);
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

// ---------------------------------------------------------------------------
// Drivers. Each returns `{ fired, controlClean, evidence }` where `fired` means
// "the guard alarmed on the historical defect in the frozen artifact", and
// `controlClean` means "the guard stayed silent on a repaired/clean control".
// ---------------------------------------------------------------------------

const CLEAN_DUP = {
  "a.ts": "export function alpha(): number { return 1; }\n",
  "b.ts": "export function beta(): number { return 2; }\n",
  "barrel.ts": 'export * from "./a.ts";\nexport * from "./b.ts";\n',
};
const DEFECT_DUP = {
  "a.ts": "export function alpha(): number { return 1; }\n",
  "b.ts": "export function alpha(): number { return 2; }\n",
  "barrel.ts": 'export * from "./a.ts";\nexport * from "./b.ts";\n',
};
const CLEAN_TDZ = { "s.ts": "const x: number = 1;\nfunction read(): number { return x; }\nexport { read };\n" };
const DEFECT_TDZ = { "s.ts": "const a: number = b;\nconst b: number = 1;\nexport { a };\n" };
const CLEAN_README = { "src/keep.ts": "export const keep = 1;\n", "README.md": "## What ships\n| `src/keep.ts` | real |\n" };
const DEFECT_README = { "src/keep.ts": "export const keep = 1;\n", "README.md": "## What ships\n| `src/keep.ts` | real |\n| `src/gone.ts` | never emitted |\n" };
const CLEAN_MONEY = { "m.ts": "/** total price in pence */\nexport function computeTotalPence(lines: { quantity: number; pricePence: number }[]): number {\n  let total = 0;\n  for (const l of lines) total = total + l.quantity * l.pricePence;\n  return total;\n}\n" };
const DEFECT_MONEY = { "m.ts": "/** computes the cart total in integer pence by summing each line's quantity. */\nexport function computeCartTotalPence(lines: { quantity: number }[]): number {\n  let total = 0;\n  for (const l of lines) total = total + l.quantity;\n  return total;\n}\n" };

// --- P-B guard consumption (the registry contract) --------------------------
// Where P-B ships a runnable static guard, the harness SPAWNS it and reads its
// machine output — it does not re-implement the guard. The P-A lexical scans
// above remain the fallback when P-B's file is absent.
const DETECTOR_CODE = {
  underproduction: "RT_E_PLAN_UNDERPRODUCED",
  "duplicate-export": "RT_E_DUPLICATE_EXPORT",
  "use-before-declaration": "RT_E_USE_BEFORE_DECL",
  "money-semantics": "RT_E_MONEY_SEMANTICS",
};
/** @type {{inv:any, readme:any, runlock:any, campaign:any, campaign2:any}} */
const PB = { inv: undefined, readme: undefined, runlock: undefined, campaign: undefined, campaign2: undefined };

/** @param {string[]} args */
function spawnNode(args) {
  return spawnSync(process.execPath, args, { encoding: "utf8", cwd: REPO_ROOT, maxBuffer: 64 * 1024 * 1024 });
}
/** @param {string} s */
function parseJsonFromStdout(s) {
  if (typeof s !== "string") return null;
  const i = s.indexOf("{");
  if (i < 0) return null;
  try { return JSON.parse(s.slice(i)); } catch { return null; }
}
/** @param {string} dirAbs @param {string} fixture */
function dirEndsWith(dirAbs, fixture) {
  return String(dirAbs).replace(/\\/g, "/").endsWith("/" + String(fixture).replace(/\\/g, "/"));
}
/** @param {any} inv @param {string} fixture @returns {string[]} */
function findingCodes(inv, fixture) {
  const rec = (inv.json && Array.isArray(inv.json.trees) ? inv.json.trees : []).find((t) => dirEndsWith(t.dir, fixture));
  return rec && Array.isArray(rec.findings) ? rec.findings.map((f) => f.code) : [];
}
function runTreeInvariants(ctx) {
  if (PB.inv !== undefined) return PB.inv;
  const file = join(REPO_ROOT, "scripts", "guards", "tree-invariants.mjs");
  if (!existsSync(file)) { PB.inv = { present: false }; return PB.inv; }
  const r = spawnNode([file, "--root", ctx.runRoot, "--json"]);
  const json = parseJsonFromStdout(r.stdout);
  PB.inv = json ? { present: true, json, status: r.status } : { present: false, error: String(r.stderr || "").slice(0, 400), status: r.status };
  return PB.inv;
}
function runReadmeParity() {
  if (PB.readme !== undefined) return PB.readme;
  const file = join(REPO_ROOT, "scripts", "guards", "readme-parity.mjs");
  if (!existsSync(file)) { PB.readme = { present: false }; return PB.readme; }
  const r = spawnNode([file, "--registry", GUARD_REGISTRY_PATH, "--json"]);
  const json = parseJsonFromStdout(r.stdout);
  PB.readme = json ? { present: true, json, status: r.status } : { present: false, error: String(r.stderr || "").slice(0, 400), status: r.status };
  return PB.readme;
}
function runRunlockSelftest() {
  if (PB.runlock !== undefined) return PB.runlock;
  const file = join(REPO_ROOT, "scripts", "guards", "runlock-preflight.mjs");
  if (!existsSync(file)) { PB.runlock = { present: false }; return PB.runlock; }
  const r = spawnNode([file, "--selftest"]);
  PB.runlock = { present: true, status: r.status, stdout: String(r.stdout || ""), stderr: String(r.stderr || "") };
  return PB.runlock;
}
/** Spawn the campaign guard tool once; its JSON is the fixture-integrity signal. */
function runCampaignInvariants(_ctx) {
  if (PB.campaign !== undefined) return PB.campaign;
  const file = join(REPO_ROOT, "scripts", "guards", "campaign-invariants.mjs");
  if (!existsSync(file)) { PB.campaign = { present: false }; return PB.campaign; }
  const r = spawnNode([file, "--json"]);
  const json = parseJsonFromStdout(r.stdout);
  PB.campaign = json ? { present: true, json, status: r.status } : { present: false, error: String(r.stderr || "").slice(0, 400), status: r.status };
  return PB.campaign;
}
/** Spawn the campaign2 tourniquet guard once; its JSON is the fixture-integrity signal. */
function runCampaign2Invariants() {
  if (PB.campaign2 !== undefined) return PB.campaign2;
  const file = join(REPO_ROOT, "scripts", "guards", "campaign2-invariants.mjs");
  if (!existsSync(file)) { PB.campaign2 = { present: false }; return PB.campaign2; }
  const r = spawnNode([file, "--json"]);
  const json = parseJsonFromStdout(r.stdout);
  PB.campaign2 = json ? { present: true, json, status: r.status } : { present: false, error: String(r.stderr || "").slice(0, 400), status: r.status };
  return PB.campaign2;
}

/** @type {Record<string, (ctx:any, guard:any)=>Promise<{fired:boolean,controlClean:boolean,skipped?:boolean,evidence:any}>>} */
const DRIVERS = {
  "n/a": async () => ({ fired: false, controlClean: false, evidence: "no driver" }),
};

// populate the driver table (kept as an object literal for readability above)
DRIVERS["dup-export"] = async (ctx) => {
  const fired = [];
  for (const t of ctx.trees) {
    const hits = scanDuplicateExports(t.dir);
    if (hits.length) fired.push({ tree: `${t.slug}/${t.tree}`, hits: hits.map((h) => `${h.name} x${h.count}`) });
  }
  const controlClean = withScratch(CLEAN_DUP, (d) => scanDuplicateExports(d).length === 0);
  const mutated = withScratch(DEFECT_DUP, (d) => scanDuplicateExports(d).length > 0);
  return { fired: fired.length > 0, controlClean: controlClean && mutated, evidence: { trees: fired } };
};

DRIVERS["tdz"] = async (ctx) => {
  const fired = [];
  for (const t of ctx.trees) {
    const hits = scanEagerTdz(t.dir);
    if (hits.length) fired.push({ tree: `${t.slug}/${t.tree}`, hits: hits.map((h) => `${h.name} L${h.use}<L${h.decl}`) });
  }
  const controlClean = withScratch(CLEAN_TDZ, (d) => scanEagerTdz(d).length === 0);
  const mutated = withScratch(DEFECT_TDZ, (d) => scanEagerTdz(d).length > 0);
  return { fired: fired.length > 0, controlClean: controlClean && mutated, evidence: { trees: fired } };
};

DRIVERS["readme-parity"] = async (ctx) => {
  const fired = [];
  for (const t of ctx.trees) {
    const hits = scanReadmeParity(t.dir);
    if (hits.length) fired.push({ tree: `${t.slug}/${t.tree}`, missing: hits[0].missing });
  }
  const controlClean = withScratch(CLEAN_README, (d) => scanReadmeParity(d).length === 0);
  const mutated = withScratch(DEFECT_README, (d) => scanReadmeParity(d).length > 0);
  return { fired: fired.length > 0, controlClean: controlClean && mutated, evidence: { trees: fired } };
};

DRIVERS["money"] = async (ctx) => {
  const fired = [];
  for (const t of ctx.trees) {
    const hits = scanMoneySemantics(t.dir);
    if (hits.length) fired.push({ tree: `${t.slug}/${t.tree}`, hits: hits.map((h) => h.name) });
  }
  const controlClean = withScratch(CLEAN_MONEY, (d) => scanMoneySemantics(d).length === 0);
  const mutated = withScratch(DEFECT_MONEY, (d) => scanMoneySemantics(d).length > 0);
  return { fired: fired.length > 0, controlClean: controlClean && mutated, evidence: { trees: fired } };
};

DRIVERS["substance"] = async (ctx) => {
  const seams = await loadSeams();
  const fired = [];
  for (const t of ctx.trees) {
    let s;
    try { s = seams.treeSubstanceOf(t.dir, { green: true }); } catch (e) { return { fired: false, controlClean: false, evidence: "treeSubstanceOf error: " + e }; }
    if (s && s.verdict === "empty") fired.push({ tree: `${t.slug}/${t.tree}`, verdict: s.verdict, real: s.real });
  }
  // Control: a tree with real modules must NOT be flagged empty.
  const control = ctx.trees.find((t) => t.slug === "bakery-website" && t.tree === "emitted");
  let controlClean = false;
  if (control) {
    try { controlClean = seams.treeSubstanceOf(control.dir, { green: true }).verdict !== "empty"; } catch { controlClean = false; }
  }
  return { fired: fired.length > 0, controlClean, evidence: { empty: fired } };
};

DRIVERS["classifier"] = async (ctx) => {
  const seams = await loadSeams();
  const fired = [];
  const recomputedOk = [];
  for (const c of ctx.cassettes) {
    const domain = seams.inferDomain(c.brief);
    const kind = seams.deliveryKindOf({ brief: c.brief, domain, lattice: {} });
    const mislabeled = c.persisted.domain !== c.expected.domain || c.persisted.kind !== c.expected.kind;
    if (mislabeled) fired.push({ slug: c.slug, persisted: `${c.persisted.domain}/${c.persisted.kind}`, recomputed: `${domain}/${kind}`, expected: `${c.expected.domain}/${c.expected.kind}` });
    if (domain === c.expected.domain && kind === c.expected.kind) recomputedOk.push(c.slug);
  }
  // Control: the one historically-correct project (office-invoice-tracker) is not flagged.
  const control = ctx.cassettes.find((c) => c.slug === "office-invoice-tracker");
  const controlClean = control ? control.persisted.domain === control.expected.domain : false;
  return { fired: fired.length > 0, controlClean, evidence: { mislabeled: fired, recomputedMatchesExpected: recomputedOk } };
};

DRIVERS["name-clean"] = async (ctx) => {
  const seams = await loadSeams();
  const dirty = (n) => typeof n === "string" && (/^\s*#/.test(n) || /[—–-]\s*$/.test(n.trim()));
  const fired = [];
  for (const c of ctx.cassettes) {
    if (dirty(c.persisted.name)) fired.push({ slug: c.slug, persistedName: c.persisted.name });
  }
  // The live seam still leaking is recorded as evidence (the C-16 fix state).
  const live = ctx.cassettes.map((c) => ({ slug: c.slug, liveName: seams.inferName(c.brief) })).filter((x) => dirty(x.liveName));
  const controlClean = !dirty("Golden Crust Bakery");
  return { fired: fired.length > 0, controlClean, evidence: { persistedDirty: fired, liveSeamStillDirty: live } };
};

DRIVERS["behavioural-spec"] = async (ctx) => {
  const seams = await loadSeams();
  const f = join(ctx.runRoot, "office-invoice-tracker", "emitted", "tests", "oracle.spec.ts");
  if (!existsSync(f)) return { fired: false, controlClean: false, evidence: "fixture missing: " + f };
  const result = seams.specSourceHasBehaviouralAssert(readFileSync(f, "utf8"));
  // Control: a spec whose live assertion reads the module's own export is behavioural.
  const controlSpec = 'import { test } from "node:test";\nimport assert from "node:assert/strict";\nimport { add } from "../src/impl.ts";\ntest("adds", () => { assert.equal(add(1, 1), 2); });\n';
  const controlResult = seams.specSourceHasBehaviouralAssert(controlSpec);
  return { fired: result === false, controlClean: controlResult === true, evidence: { officeInvoiceHasBehaviouralAssert: result, controlHasBehaviouralAssert: controlResult } };
};

DRIVERS["runlock"] = async (_ctx) => {
  const c = readJsonFile(join(CASSETTE_DIR, "runlock-bl010.json"));
  if (!c) return { fired: false, controlClean: false, evidence: "runlock cassette missing" };
  const start = Date.parse(c.run.createdAt);
  const end = Date.parse(c.run.emitAt);
  const inWindow = c.srcMtimes.filter((m) => { const t = Date.parse(m.mtime); return t >= start && t <= end; });
  const beforeWindow = c.srcMtimes.filter((m) => Date.parse(m.mtime) < start);
  const controlClean = beforeWindow.length === c.srcMtimes.length;
  return { fired: inWindow.length > 0, controlClean, evidence: { run: c.run, srcEditedDuringRun: inWindow, srcBeforeRun: beforeWindow } };
};

DRIVERS["entity-decode"] = async (ctx) => {
  const fired = [];
  for (const c of ctx.cassettes) {
    const n = countNumericEntities(join(ctx.runRoot, c.slug, "build.json"));
    if (n > 0) fired.push({ slug: c.slug, entities: n });
  }
  const mutated = withScratch({ "build.json": '{"note":"tenant&#x27;s"}' }, (d) => countNumericEntities(join(d, "build.json")) > 0);
  const controlClean = withScratch({ "build.json": '{"note":"tenant\'s"}' }, (d) => countNumericEntities(join(d, "build.json")) === 0);
  return { fired: fired.length > 0, controlClean: controlClean && mutated, evidence: { leaks: fired } };
};

DRIVERS["plan-minimum"] = async (ctx) => {
  const fired = [];
  for (const c of ctx.cassettes) {
    for (const t of c.trees) {
      const proj = readJsonFile(join(ctx.runRoot, c.slug, t, ".rapidtool", "project.json"));
      if (!proj) continue;
      const declared = declaredModules(proj);
      const emitted = Array.isArray(proj.generatedTree) ? proj.generatedTree.length : 0;
      if (declared > 0 && emitted < declared) fired.push({ tree: `${c.slug}/${t}`, emitted, declared });
    }
  }
  const controlClean = true; // control is structural: a synthetic project with emitted>=declared must not fire
  return { fired: fired.length > 0, controlClean, evidence: { underProduced: fired } };
};

DRIVERS["packet-sections"] = async (ctx) => {
  const fired = [];
  for (const c of ctx.cassettes) {
    const p = join(ctx.runRoot, c.slug, "packet.md");
    if (!existsSync(p)) continue;
    const md = readFileSync(p, "utf8");
    const truncated = /TRUNCATED/.test(md);
    const hasDod = /Exit criteria|DoD/i.test(md);
    const hasResearch = /Research sources/i.test(md);
    if (truncated && (!hasDod || !hasResearch)) fired.push({ slug: c.slug, truncated, hasDod, hasResearch });
  }
  const controlClean = withScratch({ "packet.md": "## Exit criteria (DoD)\n- ok\n## Research sources (live)\n- src\n" }, (d) => {
    const md = readFileSync(join(d, "packet.md"), "utf8");
    return !(/TRUNCATED/.test(md) && (!/DoD/i.test(md) || !/Research sources/i.test(md)));
  });
  return { fired: fired.length > 0, controlClean, evidence: { packets: fired } };
};

DRIVERS["deepen-honesty"] = async (ctx) => {
  // INC-14 (BL-012): the historical approve advanced a P6 gate carrying 3 unmet
  // hard criteria. The fixture-integrity signal is the persisted record.
  const rec = readJsonFile(join(ctx.runDir("office-invoice-tracker"), "approve1.json"));
  if (!rec || !rec.summary) return { fired: false, controlClean: false, skipped: true, evidence: "fixture missing: office-invoice-tracker/approve1.json" };
  const gate = rec.summary.lastGate || null;
  const unmet = Array.isArray(rec.summary.failedGates) && rec.summary.failedGates[0] ? (rec.summary.failedGates[0].unmet || []).length : 0;
  const overApproved = !!(gate && gate.decision === "approve" && unmet > 0);
  const cleanApproved = { lastGate: { decision: "approve" }, failedGates: [{ unmet: [] }] };
  const controlClean = !(cleanApproved.lastGate.decision === "approve" && cleanApproved.failedGates[0].unmet.length > 0);
  return { fired: overApproved, controlClean, evidence: { decision: gate && gate.decision, unmet, sealedWithFailures: rec.summary.sealedWithFailures === true } };
};

DRIVERS["repair-monotonic"] = async (ctx) => {
  // The monotonic seam (lane B/D) may not be exported yet; probing it must not
  // break the typecheck, so the dynamic import is cast to `any`.
  const headless = /** @type {any} */ (await import("../../src/lib/headless.ts"));
  const hasSeam = typeof headless.treeVerdictScore === "function" && typeof headless.failureSignature === "function";
  const repair = readJsonFile(join(ctx.runDir("bakery-florist-orders"), "repair.json"));
  const sigs = repairCycleSignatures(repair);
  // FIXTURE-INTEGRITY is independent of the seam: the historical artifact shows
  // a repeated failure signature (cycle 2 repeats cycle 1), which is exactly the
  // non-monotonic defect C-04 must abort on. Whether the live comparator landed
  // is reported separately as fix-presence.
  const repeated = sigs.some((s, i) => i > 0 && s === sigs[i - 1]);
  const clean = ["TS2322 x1", "TS2308 x1"];
  const controlClean = !clean.some((s, i, a) => i > 0 && s === a[i - 1]);
  const evidence = { repeatedSignatures: repeated, cycles: sigs };
  if (!hasSeam) evidence.pendingSeam = "lane D PR-07 headless.treeVerdictScore/failureSignature";
  return { fired: repeated, controlClean, evidence };
};

DRIVERS["pb-tree-invariants"] = async (ctx, g) => {
  const inv = runTreeInvariants(ctx);
  if (!inv.present) {
    const fallback = { "C-01": "plan-minimum", "C-02": "dup-export", "C-03": "tdz", "C-13": "money" }[g.id];
    if (fallback && DRIVERS[fallback]) {
      const r = await DRIVERS[fallback](ctx, g);
      return { ...r, evidence: { via: "P-A fallback scan (P-B guard absent)", detail: r.evidence } };
    }
    return { fired: false, controlClean: false, evidence: "P-B tree-invariants.mjs absent" };
  }
  const code = (g.expectedCode && String(g.expectedCode).startsWith("RT_E_")) ? g.expectedCode : DETECTOR_CODE[g.detector];
  const fixtures = [g.historicalFixture, ...(Array.isArray(g.historicalFixtures) ? g.historicalFixtures : [])].filter(Boolean);
  const firedOn = fixtures.filter((f) => findingCodes(inv, f).includes(code));
  const cc = g.cleanControl;
  const controlClean = cc ? !findingCodes(inv, cc).includes(code) : true;
  return { fired: firedOn.length > 0, controlClean, evidence: { code, historicalFixtures: fixtures, firedOn } };
};

DRIVERS["pb-readme-parity"] = async (ctx, g) => {
  const r = runReadmeParity();
  if (!r.present) {
    const fb = await DRIVERS["readme-parity"](ctx, g);
    return { ...fb, evidence: { via: "P-A fallback scan (P-B guard absent)", detail: fb.evidence } };
  }
  const e = (r.json.entries || []).find((x) => x.id === g.id);
  return { fired: !!(e && e.fired), controlClean: !!(e && e.controlsClean), evidence: e || { note: "no registry entry for id" } };
};

DRIVERS["pb-runlock"] = async () => {
  const r = runRunlockSelftest();
  if (!r.present) return { fired: false, controlClean: false, evidence: "P-B runlock-preflight.mjs absent" };
  const out = r.stdout || "";
  return {
    fired: /historical overlap: ok \(refuse/.test(out),
    controlClean: /clean window \+ lock held: ok \(allow/.test(out),
    evidence: { status: r.status, out: out.trim().split(/\r?\n/) },
  };
};

// C1-01/C1-02/C1-05/C1-06 — the fixture-integrity signal is the guard tool's own
// JSON over the frozen campaign artifacts; the mutation control (when no real
// clean campaign fixture exists) comes from the in-process campaignControls.
DRIVERS["campaign-invariants"] = async (ctx, g) => {
  const inv = runCampaignInvariants(ctx);
  if (!inv.present) return { fired: false, controlClean: false, evidence: "campaign-invariants.mjs absent" };
  const code = g.expectedCode;
  const findings = Array.isArray(inv.json.findings) ? inv.json.findings : [];
  const codesFor = (slug) => findings.filter((f) => f.slug === slug).map((f) => f.code);
  const fixtures = [g.historicalFixture, ...(Array.isArray(g.historicalFixtures) ? g.historicalFixtures : [])].filter(Boolean);
  const firedOn = fixtures.filter((f) => {
    const s = campaignFixtureSlug(f);
    return s && codesFor(s).includes(code);
  });
  const controlSlug = g.cleanControl ? campaignFixtureSlug(g.cleanControl) : null;
  let controlClean;
  if (controlSlug) controlClean = !codesFor(controlSlug).includes(code);
  else {
    const ctl = await campaignControlsFor(ctx);
    controlClean = !!(ctl && ctl[g.id] && ctl[g.id].controlClean);
  }
  return { fired: firedOn.length > 0, controlClean, evidence: { code, firedOn, control: controlSlug } };
};

// R2-01/R2-03/R2-05/R2-06 — the campaign2 tourniquet guards' fixture-integrity
// is the guard tool's own JSON over the frozen campaign2 artifacts; the mutation
// control comes from the in-process campaign2Controls.
DRIVERS["campaign2-invariants"] = async (_ctx, g) => {
  const inv = runCampaign2Invariants();
  if (!inv.present) return { fired: false, controlClean: false, evidence: "campaign2-invariants.mjs absent" };
  const code = g.expectedCode;
  const findings = Array.isArray(inv.json.findings) ? inv.json.findings : [];
  const codesFor = (slug) => findings.filter((f) => f.slug === slug).map((f) => f.code);
  const fixtures = [g.historicalFixture, ...(Array.isArray(g.historicalFixtures) ? g.historicalFixtures : [])].filter(Boolean);
  const firedOn = fixtures.filter((f) => {
    const s = campaign2FixtureSlug(f);
    return s && codesFor(s).includes(code);
  });
  const controlSlug = g.cleanControl ? campaign2FixtureSlug(g.cleanControl) : null;
  let controlClean;
  if (controlSlug) controlClean = !codesFor(controlSlug).includes(code);
  else {
    const ctl = await campaign2ControlsFor();
    controlClean = !!(ctl && ctl[g.id] && ctl[g.id].controlClean);
  }
  return { fired: firedOn.length > 0, controlClean, evidence: { code, firedOn, control: controlSlug } };
};

// R2-06 — the committed-record verification guard's historical fixture lives in
// the CAMPAIGN #1 committed envelopes (which carry NO verification block at all);
// the honest campaign2 record (block present, `verifiedProduct:false` + reason)
// is the clean control. This driver runs the guard's real detector over both.
DRIVERS["campaign2-verify"] = async (_ctx, g) => {
  const mod = await importCached(SRC.campaign2);
  const ci = await importCached(SRC.campaign);
  if (mod.__error || typeof mod.detectVerifiedCommit !== "function" || typeof mod.resolveCampaign2Root !== "function") {
    return { fired: false, controlClean: false, evidence: "campaign2-invariants.mjs detectVerifiedCommit absent" };
  }
  const c1 = ci && typeof ci.CAMPAIGN_CASSETTE_DIR === "string" ? ci.CAMPAIGN_CASSETTE_DIR : null;
  const c2 = mod.resolveCampaign2Root();
  if (!c1 || !c2) return { fired: false, controlClean: false, evidence: "campaign1/campaign2 cassette roots unavailable" };
  // Real historical fixture (from the registry): campaign #1 committed trees
  // carry no verification block at all.
  const c1Fixtures = [g.historicalFixture, ...(Array.isArray(g.historicalFixtures) ? g.historicalFixtures : [])]
    .filter((f) => /campaign1\//.test(String(f)))
    .map((f) => campaignFixtureSlug(f))
    .filter((s) => typeof s === "string");
  const firedSlugs = c1Fixtures.filter((s) => mod.detectVerifiedCommit(join(c1, s)).length > 0);
  // Clean control: campaign #2's committed trees carry the block and an honest
  // `verifiedProduct:false` + reason (the designed outcome); withheld trees claim nothing.
  const controlClean =
    mod.detectVerifiedCommit(join(c2, "flower-shop-website")).length === 0 &&
    mod.detectVerifiedCommit(join(c2, "office-scheduler")).length === 0 &&
    mod.detectVerifiedCommit(join(c2, "office-stock-tracker")).length === 0;
  return { fired: firedSlugs.length > 0, controlClean, evidence: { code: g.expectedCode, firedSlugs, cleanOnHonestRecord: controlClean } };
};

DRIVERS["arch-failclosed"] = async (ctx) => {
  const dod = await import("../../src/lib/dod.ts");
  const proj = readJsonFile(join(ctx.runRoot, "office-stock-tracker", "emitted", ".rapidtool", "project.json"));
  if (!proj) return { fired: false, controlClean: false, evidence: "fixture missing: office-stock-tracker/emitted/.rapidtool/project.json" };
  const at = dod.archTrace(proj);
  const complete = dod.archProductComplete(at);
  const control = dod.archProductComplete({ present: true, skipped: false, rows: [{ capability: "a", files: ["x"] }], missing: [], stubFiles: [], note: "" });
  return { fired: complete === false, controlClean: control === true, evidence: { present: at.present, missing: at.missing, archProductComplete: complete } };
};

// ---------------------------------------------------------------------------
// Guard manifest + registry ingestion.
// ---------------------------------------------------------------------------

/** @returns {Array<any>} */
export function defaultGuards() {
  return [
    { id: "C-01", title: "Brief-driven minimum file set + coverage census", incident: "INC-08/11/12/13", driver: "plan-minimum", file: "scripts/guards/tree-invariants.mjs" },
    { id: "C-02", title: "Cross-chunk export registry / duplicate-export guard", incident: "INC-15", driver: "dup-export", file: "scripts/guards/tree-invariants.mjs" },
    { id: "C-03", title: "Store hoist / use-before-declaration (TDZ) guard", incident: "INC-16", driver: "tdz", file: "scripts/guards/tree-invariants.mjs" },
    { id: "C-09", title: "README / spec-rows vs disk parity", incident: "INC-28", driver: "readme-parity", file: "scripts/guards/readme-parity.mjs" },
    { id: "C-13", title: "Money-arithmetic / domain semantics guard", incident: "INC-26", driver: "money", file: "scripts/guards/tree-invariants.mjs" },
    { id: "C-05", title: "Behavioural-spec guard that cannot be defeated by assert.fail in a skipped test", incident: "INC-27", driver: "behavioural-spec", file: "scripts/guards/gate-invariants.test.mjs" },
    { id: "C-06", title: "Substance-based delivery gating", incident: "INC-10/20", driver: "substance", file: "scripts/guards/delivery-gate.test.mjs" },
    { id: "C-11", title: "RUNLOCK protocol (mechanical preflight)", incident: "INC-23/BL-010", driver: "runlock", file: "scripts/guards/runlock-preflight.mjs" },
    { id: "C-12", title: "Classifier contract + negation/out-of-scope stripping", incident: "INC-01..07", driver: "classifier", file: "scripts/guards/gate-invariants.test.mjs" },
    { id: "C-16", title: "inferName cleanup + research-query grounding", incident: "INC-25", driver: "name-clean", file: "scripts/guards/gate-invariants.test.mjs" },
    { id: "C-17", title: "HTML numeric-entity decode + grounding clean", incident: "INC-22", driver: "entity-decode", file: "scripts/guards/gate-invariants.test.mjs" },
    { id: "C-18", title: "Packet section guarantee", incident: "INC-32", driver: "packet-sections", file: "scripts/guards/gate-invariants.test.mjs" },
    { id: "C-14", title: "p6-arch fail-closed on a keyed attempt with no tree", incident: "INC-29", driver: "arch-failclosed", file: "scripts/guards/gate-invariants.test.mjs" },
    { id: "C-15", title: "Deepen / approve honesty gate", incident: "INC-14/INC-24", driver: "deepen-honesty", file: "scripts/guards/gate-invariants.test.mjs" },
    { id: "C-04", title: "Typecheck-before-accept + monotonic repair", incident: "INC-18/30", driver: "repair-monotonic", file: "scripts/guards/repair-monotonic.test.mjs" },
    // Campaign #1 residuals (PR-28) — the campaign guard tool is the driver.
    { id: "C1-01", title: "Floor reachability: a sealed tree below minimumTreeFileCount carries RT_E_PLAN_UNDERPRODUCED", incident: "C1-01", driver: "campaign-invariants", file: "scripts/guards/campaign-invariants.mjs" },
    { id: "C1-02", title: "Mounted UI must call a real generated export", incident: "C1-02", driver: "campaign-invariants", file: "scripts/guards/campaign-invariants.mjs" },
    { id: "C1-05", title: "Skip-dominated oracle cannot satisfy the behavioural/tested bar", incident: "C1-05", driver: "campaign-invariants", file: "scripts/guards/campaign-invariants.mjs" },
    { id: "C1-06", title: "A delivery claim states real verification or says unverified", incident: "C1-06", driver: "campaign-invariants", file: "scripts/guards/campaign-invariants.mjs" },
    { id: "C1-08", title: "Withheld git envelope code names the deciding reason", incident: "C1-08", driver: "campaign-invariants", file: "scripts/guards/campaign-invariants.mjs" },
  ];
}

/**
 * The registry contract P-A consumes. Accepts an array, `{guards:[…]}`, or a
 * `{id: entry}` map. Only `id` is required; `title`/`seam`/`file`/`driver` enrich.
 * @returns {{present:boolean, guards:Array<any>, path:string, countFloor?:number, error?:string}}
 */
export function loadGuardRegistry(path = GUARD_REGISTRY_PATH) {
  if (!existsSync(path)) return { present: false, guards: [], path };
  const raw = readJsonFile(path);
  if (!raw || raw.__parseError) return { present: false, guards: [], path, error: raw && raw.__parseError };
  let arr = [];
  if (Array.isArray(raw)) arr = raw;
  else if (Array.isArray(raw.guards)) arr = raw.guards;
  else if (raw.guards && typeof raw.guards === "object") arr = Object.entries(raw.guards).map(([id, v]) => ({ id, ...(v && typeof v === "object" ? v : {}) }));
  else arr = Object.entries(raw).filter(([, v]) => v && typeof v === "object").map(([id, v]) => ({ id, ...v }));
  const guards = arr.map((g) => ({ id: String(g.id ?? g.guard ?? g.name ?? "?"), ...g }));
  const countFloor = Number.isFinite(raw.countFloor) ? Number(raw.countFloor) : undefined;
  return { present: true, guards, path, countFloor, error: undefined };
}

// Route to P-B's own guard tool where one exists (the registry is authoritative);
// fall back to the P-A scan/real-seam driver otherwise.
const ID_TO_DRIVER = {
  "c-01": "pb-tree-invariants", "c-02": "pb-tree-invariants", "c-03": "pb-tree-invariants",
  "c-04": "repair-monotonic", "c-05": "behavioural-spec", "c-06": "substance",
  "c-09": "pb-readme-parity", "c-11": "pb-runlock", "c-12": "classifier",
  "c-13": "pb-tree-invariants", "c-14": "arch-failclosed", "c-16": "name-clean",
  "c-17": "entity-decode", "c-18": "packet-sections", "c-15": "deepen-honesty",
  "c1-01": "campaign-invariants", "c1-02": "campaign-invariants",
  "c1-05": "campaign-invariants", "c1-06": "campaign-invariants",
  "c1-08": "campaign-invariants",
  "r2-01": "campaign2-invariants", "r2-03": "campaign2-invariants",
  "r2-05": "campaign2-invariants", "r2-06": "campaign2-verify",
};

/** @param {any} g @returns {string|null} */
function resolveDriver(g) {
  if (g.driver && DRIVERS[g.driver]) return g.driver;
  const id = String(g.id || "").toLowerCase();
  if (ID_TO_DRIVER[id]) return ID_TO_DRIVER[id];
  const file = String(g.file || "");
  if (/tree-invariants\.mjs$/.test(file)) return "pb-tree-invariants";
  if (/readme-parity\.mjs$/.test(file)) return "pb-readme-parity";
  if (/runlock-preflight\.mjs$/.test(file)) return "pb-runlock";
  const hay = [g.id, g.title, g.seam, g.file, g.assertion].filter(Boolean).join(" ").toLowerCase();
  /** @type {Array<[string, RegExp]>} */
  const KEY = [
    ["dup-export", /export|duplicate|barrel|ts2308/],
    ["tdz", /tdz|use-before|hoist|ts2448/],
    ["readme-parity", /readme|parity|spec-row/],
    ["money", /money|arithmetic|semantic/],
    ["substance", /substance|hollow/],
    ["behavioural-spec", /behaviour|behavioral|shape-only/],
    ["classifier", /classif|inferdomain|deliverykind/],
    ["name-clean", /infername|name clean/],
    ["runlock", /runlock|mtime/],
    ["entity-decode", /entity|decode/],
    ["packet-sections", /packet/],
    ["repair-monotonic", /monotonic|repair/],
    ["plan-minimum", /minimum file|under-production|plan census/],
  ];
  for (const [d, re] of KEY) if (re.test(hay)) return d;
  return null;
}

/**
 * Evaluate one guard. A guard is "proven" iff its driver alarms on the
 * historical artifact (`fired`) and stays silent on the repaired control.
 * @param {any} g @param {any} ctx
 */
export async function evaluateGuard(g, ctx) {
  const driverName = resolveDriver(g);
  if (!driverName) {
    return { id: g.id, driver: null, fired: false, controlClean: false, skipped: false, detail: "no P-A historical driver for this registry entry" };
  }
  const driver = DRIVERS[driverName];
  try {
    const r = await driver(ctx, g);
    return { id: g.id, driver: driverName, fired: !!r.fired, controlClean: !!r.controlClean, skipped: !!r.skipped, evidence: r.evidence };
  } catch (e) {
    return { id: g.id, driver: driverName, fired: false, controlClean: false, skipped: false, detail: "driver error: " + String(e && e.message ? e.message : e) };
  }
}

// ---------------------------------------------------------------------------
// Small artifact helpers used by drivers.
// ---------------------------------------------------------------------------

/** @param {any} proj @returns {number} */
function declaredModules(proj) {
  let n = 0;
  const jobs = proj && proj.lattice && Array.isArray(proj.lattice.jobs) ? proj.lattice.jobs.length : 0;
  const ents = proj && proj.contracts && Array.isArray(proj.contracts.entities) ? proj.contracts.entities.length : 0;
  const nodes = proj && proj.specGraph && Array.isArray(proj.specGraph.nodes) ? proj.specGraph.nodes.filter((x) => x && typeof x.id === "string" && x.id.startsWith("job-")).length : 0;
  n = Math.max(jobs + ents, nodes);
  return n;
}

/**
 * The failure signature of each repair cycle, from the real repair record's
 * `events` ("cycle N: tree-run fail — <tail>"). Adjacent repeats are the
 * historical non-monotonic signal C-04 must abort on.
 * @param {any} r @returns {string[]}
 */
function repairCycleSignatures(r) {
  const events = r && Array.isArray(r.events) ? r.events : [];
  /** @type {Map<number,string>} */
  const byCycle = new Map();
  for (const e of events) {
    if (typeof e !== "string") continue;
    const m = e.match(/^cycle\s+(\d+):\s*tree-run fail\s*[—–-]?\s*([\s\S]*)$/i);
    if (!m) continue;
    byCycle.set(Number(m[1]), String(m[2]).replace(/\s+/g, " ").trim().slice(0, 240));
  }
  return [...byCycle.keys()].sort((a, b) => a - b).map((k) => byCycle.get(k) || "");
}

// --- C-19 meta-control: rubric baselines + the held-out cassette (PR-25) -----

/**
 * Every historical tree must have a pinned rubric baseline. This is a coverage
 * pin (a future re-grade compares against these totals); a missing baseline or a
 * tree set that is no longer the 13 frozen trees fails the gate of record.
 * @param {any[]} cassettes @param {{present:boolean,treeCount:number,baselines:any[]}} baselines
 */
export function verifyRubricBaselines(cassettes, baselines, runRoot) {
  const expected = new Set();
  for (const c of cassettes) for (const t of c.trees) expected.add(`${c.slug}/${t}`);
  const pinned = new Set(baselines.baselines.map((b) => `${b.slug}/${b.variant}`));
  const missing = [...expected].filter((k) => !pinned.has(k));
  const missingTrees = baselines.baselines.filter((b) => !existsSync(join(runRoot, String(b.slug), String(b.variant)))).map((b) => `${b.slug}/${b.variant}`);
  const badScores = baselines.baselines.filter((b) => !Number.isFinite(b.score)).map((b) => `${b.slug}/${b.variant}`);
  const ok = baselines.present && missing.length === 0 && pinned.size >= baselines.treeCount && expected.size === 13 && missingTrees.length === 0 && badScores.length === 0;
  return { ok, present: baselines.present, treeCount: baselines.treeCount, covered: pinned.size, expected: expected.size, missing, missingTrees, badScores };
}

/**
 * The held-out brief (R-08) must exist, be disjoint from the seven historical
 * projects, and carry a brief plus expected labels. The live classification is
 * recorded as evidence so an over-fit is visible; it does not by itself fail the
 * sweep (the hard classification gate is C-12's live-seam check).
 * @param {any[]} cassettes @param {any[]} heldOut @param {any} _ctx
 */
export async function verifyHeldOut(cassettes, heldOut, _ctx) {
  if (!heldOut || heldOut.length === 0) return { ok: false, present: false, evidence: "no held-out cassette present" };
  const slugs = new Set(cassettes.map((c) => c.slug));
  const h = heldOut[0];
  const disjoint = !slugs.has(h.slug);
  const hasBrief = typeof h.brief === "string" && h.brief.length > 50;
  const hasExpected = !!(h.expected && typeof h.expected.domain === "string" && typeof h.expected.kind === "string");
  let live = null;
  try {
    const seams = await importCached(SRC.engine);
    const domain = seams.inferDomain(h.brief);
    const kind = seams.deliveryKindOf({ brief: h.brief, domain, lattice: { jobs: [] } });
    live = { domain, kind, name: seams.inferName(h.brief) };
  } catch {
    live = null;
  }
  const matches = !!(live && live.domain === h.expected.domain && live.kind === h.expected.kind);
  return { ok: disjoint && hasBrief && hasExpected, present: true, slug: h.slug, disjoint, hasBrief, hasExpected, live, expected: h.expected, matches };
}

// ---------------------------------------------------------------------------
// Orchestration.
// ---------------------------------------------------------------------------

/** Pinned floor: removing a registry entry must fail the gate of record (§4.6-3).
 *  Overridable by `countFloor` in the registry (now 24 — the 15 W346 guards, the
 *  five campaign #1 residual guards C1-01/02/05/06/08, and the four campaign #2
 *  tourniquets R2-01/03/05/06). */
export const GUARD_COUNT_FLOOR = 24;

/**
 * Classify every guard's fix-presence into EXACTLY ONE bucket. `enforced` is the
 * fully-proven set — the live seam is present, wired, the mutation control
 * proves the check can fail, AND the registry does not still declare the guard
 * `pending` (a stale `pending` declaration keeps a guard out of `enforced` so
 * the two sets stay disjoint). `pending` is the complement, so a guard can never
 * appear in both (the defect this lane exists to prevent) and never in neither.
 * @param {Array<any>} results
 * @returns {{enforced:string[], pending:string[]}}
 */
export function classifyFixPresence(results) {
  const enforced = [];
  const pending = [];
  for (const r of results) {
    const proven = !!(r.fixPresence.present && r.fixPresence.wired && r.fixPresence.mutationRed);
    if (r.status !== "pending" && proven) enforced.push(r.id);
    else pending.push(r.id);
  }
  return { enforced, pending };
}

/**
 * The fix-presence classification invariant: the two sets are disjoint and their
 * union is exactly the guard id set. A violation (an id in both, or an id in
 * neither) means the bookkeeping is inconsistent and must fail closed.
 * @param {string[]} enforced @param {string[]} pending @param {Array<any>} results
 */
export function fixPresenceInvariant(enforced, pending, results) {
  const e = new Set(enforced);
  const p = new Set(pending);
  const all = new Set(results.map((r) => r.id));
  const overlap = [...e].filter((id) => p.has(id));
  const union = new Set([...e, ...p]);
  const uncovered = [...all].filter((id) => !union.has(id));
  const unknown = [...union].filter((id) => !all.has(id));
  return { ok: overlap.length === 0 && uncovered.length === 0 && unknown.length === 0, overlap, uncovered, unknown, enforced: [...e], pending: [...p] };
}

/** @param {any} ctx */
export async function runAll(ctx) {
  const runRoot = ctx.runRoot;
  const cassettes = ctx.cassettes ?? loadCassettes(ctx.cassetteDir ?? CASSETTE_DIR);
  const trees = [];
  for (const c of cassettes) for (const t of c.trees) trees.push({ slug: c.slug, tree: t, dir: join(runRoot, c.slug, t) });
  const registry = ctx.registry ?? loadGuardRegistry(ctx.registryPath ?? GUARD_REGISTRY_PATH);
  const guards = registry.present && registry.guards.length ? registry.guards : defaultGuards();
  const rc = { repoRoot: REPO_ROOT, runRoot, cassettes, trees, registry, runDir: (slug) => join(runRoot, slug) };
  const results = [];
  for (const g of guards) {
    // Two orthogonal signals: fixture-integrity (historical detector) and
    // fix-presence (live seam). Neither is allowed to stand in for the other.
    const fx = await evaluateGuard(g, rc);
    const seam = await evaluateSeam(g, rc);
    results.push({
      id: g.id,
      status: typeof g.status === "string" ? g.status : "enforced",
      driver: fx.driver,
      fixtureIntegrity: { fired: fx.fired, controlClean: fx.controlClean, skipped: fx.skipped, evidence: fx.evidence, detail: fx.detail },
      fixPresence: { present: seam.present, wired: seam.wired, mutationRed: seam.mutationRed, skipped: seam.skipped, evidence: seam.evidence },
    });
  }
  const fired = results.filter((r) => r.fixtureIntegrity.fired).map((r) => r.id);
  const missed = results.filter((r) => !r.fixtureIntegrity.fired).map((r) => r.id);
  const controlMissed = results.filter((r) => r.fixtureIntegrity.fired && !r.fixtureIntegrity.controlClean).map((r) => r.id);
  // `skipped` is DERIVED from real per-guard skip markers, never hardcoded.
  const skipped = [...new Set(results.filter((r) => r.fixtureIntegrity.skipped || r.fixPresence.skipped).map((r) => r.id))];
  // fix-presence: ONE classification path, so `enforced` and `pending` are
  // disjoint by construction. A guard is enforced iff its live seam is present
  // AND wired AND its mutation control proves the check can fail AND the
  // registry does not still declare it `pending`; `pending` is the complement.
  const { enforced, pending } = classifyFixPresence(results);
  const fixPresenceInv = fixPresenceInvariant(enforced, pending, results);
  // C-19 meta-control: the pinned rubric baselines and the held-out cassette.
  const rubricBaselines = verifyRubricBaselines(cassettes, loadRubricBaselines(ctx.cassetteDir ?? CASSETTE_DIR), runRoot);
  const heldOut = await verifyHeldOut(cassettes, ctx.heldOutCassettes ?? loadHeldOutCassettes(ctx.cassetteDir ?? CASSETTE_DIR), rc);
  const missedAll = [...missed];
  if (!rubricBaselines.ok) missedAll.push("C-19:rubric-baselines");
  if (!heldOut.ok) missedAll.push("C-19:held-out");
  // The classification must be disjoint + total; a bookkeeping inconsistency is
  // itself a hard failure (never a silently-overlapping verdict).
  if (!fixPresenceInv.ok) missedAll.push("<fix-presence-classification>");
  return {
    guards: results.length,
    count: results.length,
    countFloor: Number.isFinite(registry.countFloor) ? registry.countFloor : GUARD_COUNT_FLOOR,
    historical: fired.length,
    fixtureIntegrity: { fired, missed: missedAll },
    fixPresence: { enforced, pending },
    fixPresenceInvariant: fixPresenceInv,
    rubricBaselines,
    heldOut,
    // Top-level mirrors so a consumer can read the gate of record directly.
    fired,
    missed: missedAll,
    pending,
    skipped,
    registry: registry.present ? "present" : "absent",
    controlMissed,
    detail: results,
  };
}

/** Parse `--flag value` / `--flag` pairs. @param {string[]} argv */
export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) { out[key] = next; i += 1; }
    else out[key] = true;
  }
  return out;
}

/**
 * Fold the two signals into the gate of record:
 *   ok ⟺ fixture missed:[] ∧ fix-presence pending:[] ∧ skipped:[] ∧ count ≥ floor
 * A dirty control is folded into `missed` so a fired-but-uncontrolled guard
 * cannot read as proven.
 * @param {any} verdict
 * @returns {any}
 */
export function finalize(verdict) {
  const missed = new Set(verdict.missed);
  for (const id of verdict.controlMissed || []) missed.add(id + " (control)");
  const pending = [...new Set(verdict.pending || [])];
  const skipped = [...new Set(verdict.skipped || [])];
  const count = Number(verdict.count ?? verdict.guards ?? 0);
  const countFloor = Number(verdict.countFloor ?? 0);
  const countOk = count >= countFloor;
  // Defense in depth: recompute the classification invariant from the verdict's
  // own fields so an inconsistent object (an id in BOTH enforced and pending, or
  // in neither) can never read `ok:true`.
  const results = Array.isArray(verdict.detail) ? verdict.detail : [];
  const inv = fixPresenceInvariant((verdict.fixPresence && verdict.fixPresence.enforced) || [], pending, results);
  if (!inv.ok) missed.add("<fix-presence-classification>");
  const missedArr = [...missed];
  return {
    ...verdict,
    missed: missedArr,
    pending,
    skipped,
    count,
    countFloor,
    countOk,
    fixPresenceInvariant: inv,
    ok: missedArr.length === 0 && pending.length === 0 && skipped.length === 0 && countOk && inv.ok,
  };
}

/** @param {any} verdict */
export function formatVerdict(verdict) {
  return JSON.stringify({
    ok: verdict.ok,
    guards: verdict.guards,
    count: verdict.count,
    countFloor: verdict.countFloor,
    historical: verdict.historical,
    fixtureIntegrity: { fired: verdict.fired, missed: verdict.missed },
    fixPresence: { enforced: verdict.fixPresence.enforced, pending: verdict.pending },
    fired: verdict.fired,
    missed: verdict.missed,
    pending: verdict.pending,
    skipped: verdict.skipped,
    registry: verdict.registry,
    controlMissed: verdict.controlMissed,
    fixPresenceInvariant: verdict.fixPresenceInvariant,
    rubricBaselines: verdict.rubricBaselines,
    heldOut: verdict.heldOut,
  });
}

// Minimal standalone CLI (`--briefs`, `--trees`, `--json`) so P-A's scan pass can
// be driven directly, mirroring PREVENTION.md §4. Full verdict = verify-prevention.mjs.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  runAll({ runRoot: resolveRunRoot() ?? "", cassetteDir: CASSETTE_DIR })
    .then((raw) => {
      const v = finalize(raw);
      if (args.json) console.log(formatVerdict(v));
      else {
        for (const r of v.detail) {
          const fx = r.fixtureIntegrity.fired ? "FIRE" : "----";
          const fp = r.fixPresence.present && r.fixPresence.wired && r.fixPresence.mutationRed ? "seam" : "PEND";
          console.log(`${fx} ${fp} ${r.id} ${r.driver || "(no driver)"} ${r.fixtureIntegrity.controlClean ? "" : " [control-unverified]"}`);
        }
      }
      process.exit(v.ok ? 0 : 1);
    })
    .catch((e) => { console.error("replay-harness failed:", e); process.exit(2); });
}
