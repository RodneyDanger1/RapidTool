// ---------------------------------------------------------------------------
// scripts/acceptance-run.mjs — the repeatable keyed acceptance harness.
//
// Given a brief (a file path or prose), this harness drives the FULL governed
// pipeline through `src/lib/headless.ts` on a bare-Node host, emits the
// product tree to disk, verifies the emitted tree's own declared toolchain,
// and prints ONE JSON verdict. It is honest by construction: a red tree, a
// stub-only tree, a missing declared entry (index.html for a web kind; a
// bin/main or src entry for a tool/library/service), or an unresolved/unverified
// toolchain all produce `ok:false` (exit 1) — never a green verdict over red
// bytes.
//
// Why it drives headless directly (rather than shelling the CLI verbs): the
// CLI's in-run RUNLOCK guard (`RT_E_SRC_EDITED_DURING_RUN`) refuses a drive
// whose repo `src/**`/`scripts/**` changed mid-run — correct for a frozen-tree
// measurement, but it makes the CLI unusable as a harness in a tree that
// sibling agents are editing. This harness measures the emitted PRODUCT, not
// the host repo's immutability, so it calls the same driver functions the CLI
// arm calls, in-process.
//
// Usage:
//   node --experimental-strip-types scripts/acceptance-run.mjs \
//     --brief <path|text> [--name <text>] [--out <dir>] \
//     [--keyless] [--max-steps N] [--p6-retries N] [--install] [--json]
//
//   # batch: one brief per <out>/<slug>/verdict.json + a roll-up table
//   node --experimental-strip-types scripts/acceptance-run.mjs \
//     --suite <dir-of-*.md | a.md,b.md,...> --out <dir> \
//     [--keyless] [--max-steps N] [--p6-retries N] [--install]
//
// `--suite` runs each brief SEQUENTIALLY (one governed run at a time, never a
// loop) and prints a roll-up table to stderr; stdout stays exactly one JSON
// object (the same table is in `rollup.table`). The suite is `ok:true` only
// when EVERY brief is `ok`.
//
// Key resolution mirrors the CLI exactly (`<cwd>/.env` wins over the process
// env; a present-but-blank process value is an intentional keyless disable;
// the conflict prints a tail-only coded warning to stderr). The key value is
// never printed, returned, or logged.
// ---------------------------------------------------------------------------

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");

/** Src entries a webapp tree may mount (checked in priority order). */
const WEB_SRC_ENTRIES = [
  "src/main.tsx",
  "src/main.ts",
  "src/main.jsx",
  "src/index.tsx",
  "src/index.ts",
  "src/app.tsx",
  "src/App.tsx",
];

/**
 * The DeliveryKind values whose emitted tree carries an HTML web entry. The
 * emit path adds `index.html` ONLY for these kinds (the product-quality reading
 * says so verbatim), so a `tool`/`library`/`service` tree legitimately has
 * none — demanding one there is a false negative, not a finding.
 */
export const WEB_ENTRY_KINDS = ["app", "game"];

const NON_WEB_ENTRY_FILES = [
  "src/main.ts",
  "src/main.mjs",
  "src/main.js",
  "src/index.ts",
  "src/cli.ts",
  "src/cli.mjs",
  "cli.mjs",
  "index.mjs",
];

/**
 * Resolve the tree's OWN declared entry artifact, keyed on the project's
 * DeliveryKind. A web kind (`app`/`game`) requires `index.html` + a src mount;
 * every other kind (`tool`/`library`/`service`) requires a real program entry
 * (a `bin`/`main` package field, a `bin/*.{mjs,js,cjs}`, or a `src/main.*` /
 * `src/cli.*` file) and is NOT failed for having no HTML. Pure; exported for
 * test. `kind` absent ⇒ the historical web requirement (fail-closed).
 * @param {string[]} files
 * @param {{ bin?: unknown; main?: unknown }} [pkg]
 * @param {string | null | undefined} [kind]
 */
export function resolveTreeEntry(files, pkg = {}, kind = null) {
  const has = (p) => files.includes(p);
  const html = has("index.html") ? "index.html" : null;
  const webMount = WEB_SRC_ENTRIES.find((p) => has(p)) ?? null;
  const web = {
    ok: html !== null && webMount !== null,
    mode: "web",
    html,
    entry: webMount,
    detail:
      html === null
        ? "index.html missing"
        : webMount === null
          ? `no src entry (looked for ${WEB_SRC_ENTRIES.join(", ")})`
          : null,
  };
  const kindIsWeb = typeof kind === "string" && WEB_ENTRY_KINDS.includes(kind);
  if (kindIsWeb || kind === undefined || kind === null) return web;
  const binField = pkg?.bin;
  const binPath =
    typeof binField === "string"
      ? binField
      : binField && typeof binField === "object"
        ? String(Object.values(binField)[0] ?? "")
        : "";
  const mainField = typeof pkg?.main === "string" ? pkg.main : "";
  const declared = [
    ...(binPath ? [binPath.replace(/^\.\//, "")] : []),
    ...(mainField ? [mainField.replace(/^\.\//, "")] : []),
    ...NON_WEB_ENTRY_FILES,
  ].find((p) => p.length > 0 && has(p));
  const binFile = files.find((f) => /^bin\/.+\.(mjs|js|cjs)$/.test(f));
  const entry = declared ?? binFile ?? null;
  return {
    ok: entry !== null,
    mode: kind,
    kind,
    html,
    entry,
    detail:
      entry !== null
        ? null
        : `no ${kind} entry (looked for a package.json bin/main field, bin/*.mjs, or ${NON_WEB_ENTRY_FILES.join(", ")})`,
  };
}

/**
 * The emit policy the harness uses to land the product on disk. It mirrors the
 * CLI's `emit --red-tree banner` (`scripts/rapidtool-cli.mjs`), which admits
 * BOTH a red tree-run trail AND a below-floor `RT_E_PLAN_UNDERPRODUCED` partial,
 * each with the unmissable caution banner. Passing `redTree` alone leaves the
 * default `underProduced:"refuse"` in place, so a below-floor partial the CLI
 * would write lands zero files here (`emit.ok:false`) and mis-reports "no tree".
 * Landing it does NOT lower the verdict bar: a red or below-floor tree still
 * fails `treeRun.ok`/`tree.substantive`/`run.cleanSeal`, so `ok` stays false —
 * the difference is that the landed product becomes measurable.
 */
export function acceptanceEmitOptions() {
  return { redTree: "banner", underProduced: "banner" };
}

// ---------------------------------------------------------------------------
// argv (a tiny parser — the CLI's own parseArgs is not exported)
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  /** @type {{ _: string[]; [key: string]: any }} */
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      out._.push(a);
      continue;
    }
    const eq = a.indexOf("=");
    if (eq !== -1) {
      out[a.slice(2, eq)] = a.slice(eq + 1);
      continue;
    }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      out[key] = next;
      i += 1;
    } else {
      out[key] = true;
    }
  }
  return out;
}

function hasFlag(args, name) {
  return args[name] === true || args[name] === "true" || args[name] === "1";
}

// ---------------------------------------------------------------------------
// Brief input: a readable path (or `@path`) is read; anything else is prose.
// ---------------------------------------------------------------------------

/**
 * The `brief:` scalar of a leading YAML front-matter fence, or null. The corpus
 * fixtures (research/eval-corpus/*.md) carry the real prose in this scalar; the
 * CLI unwraps it (rapidtool-cli.mjs briefFromFrontmatter) so the lattice never
 * sees the front matter. This harness feeds headless directly, so it must apply
 * the same unwrap or it mines nouns from the YAML keys.
 * @param {string} text
 * @returns {string | null}
 */
export function briefFromFrontmatter(text) {
  if (!text.startsWith("---")) return null;
  const end = text.indexOf("\n---", 3);
  if (end === -1) return null;
  const m = text.slice(3, end).match(/^brief:\s*(.+)$/m);
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v.trim() || null;
}

export function readBriefSpec(spec) {
  if (typeof spec !== "string" || spec.trim() === "") {
    return { ok: false, error: "--brief is required (a file path, @path, or the brief prose)" };
  }
  const raw = spec.startsWith("@") ? spec.slice(1) : spec;
  const asPath = resolve(process.cwd(), raw);
  if (existsSync(asPath)) {
    try {
      const st = statSync(asPath);
      if (!st.isFile()) return { ok: false, error: `--brief ${raw} is not a file` };
      const fileText = readFileSync(asPath, "utf8").trim();
      if (fileText.length === 0) return { ok: false, error: `--brief ${raw} is empty` };
      // A corpus fixture's `brief:` front-matter scalar is the prose; feeding
      // the whole file (front matter included) to the lattice is the bug.
      const brief = briefFromFrontmatter(fileText) ?? fileText;
      return { ok: true, brief, source: asPath, frontmatterUnwrapped: brief !== fileText };
    } catch (err) {
      return { ok: false, error: `--brief ${raw}: ${err instanceof Error ? err.message : String(err)}` };
    }
  }
  const prose = spec.trim();
  return prose.length >= 12
    ? { ok: true, brief: prose, source: null }
    : { ok: false, error: "--brief prose is shorter than 12 chars and is not an existing file" };
}

// ---------------------------------------------------------------------------
// Key resolution — identical precedence to the CLI (scripts/rapidtool-cli.mjs).
// ---------------------------------------------------------------------------

async function installRepoEnvKey() {
  const dotenvPath = resolve(process.cwd(), ".env");
  let text = "";
  try {
    text = readFileSync(dotenvPath, "utf8");
  } catch {
    text = "";
  }
  let mod;
  try {
    mod = await import(pathToFileURL(join(REPO_ROOT, "src/lib/llm/providers/key-resolution.ts")).href);
  } catch {
    return { kind: "process-env-fallback" };
  }
  process.env.RAPIDTOOL_LLM_ENV_FILE = dotenvPath;
  const parsed = mod.parseEnvFile(text);
  const warn = (name, conflict) => {
    try {
      process.stderr.write(mod.formatShadowWarning(name, dotenvPath, conflict) + "\n");
    } catch {
      /* stderr unusable — the conflict is resolved, never silently */
    }
  };
  const resolution = mod.resolveApiKey({
    name: "DEEPSEEK_API_KEY",
    envFileValue: parsed.DEEPSEEK_API_KEY ?? null,
    envFilePath: dotenvPath,
    processValue: process.env.DEEPSEEK_API_KEY ?? null,
  });
  if (resolution.effective) {
    process.env.DEEPSEEK_API_KEY = resolution.effective.value;
    mod.setActiveKeySource(resolution.effective);
  } else {
    mod.setActiveKeySource(null);
    delete process.env.DEEPSEEK_API_KEY;
  }
  if (resolution.conflict) warn("DEEPSEEK_API_KEY", resolution.conflict);
  // Research key: the same precedence so `--live` research can use Tavily from
  // the repo `.env` (the driver reads process.env.TAVILY_API_KEY directly).
  const tavily = mod.resolveApiKey({
    name: "TAVILY_API_KEY",
    envFileValue: parsed.TAVILY_API_KEY ?? null,
    envFilePath: dotenvPath,
    processValue: process.env.TAVILY_API_KEY ?? null,
  });
  if (tavily.effective) process.env.TAVILY_API_KEY = tavily.effective.value;
  if (tavily.conflict) warn("TAVILY_API_KEY", tavily.conflict);
  return {
    kind: resolution.effective ? resolution.effective.kind : "keyless",
    research: tavily.effective ? tavily.effective.kind : "keyless",
  };
}

// ---------------------------------------------------------------------------
// Pure verdict model — exported so the colocated test can pin its honesty
// without a keyed run. `ok` is true ONLY when EVERY assertion is true.
// ---------------------------------------------------------------------------

export function evaluateAcceptance(facts) {
  const assertions = [];
  const add = (id, ok, detail) => assertions.push({ id, ok: Boolean(ok), detail });

  const tree = facts.tree ?? {};
  const treeRun = facts.treeRun ?? {};
  const run = facts.run ?? {};
  const substance = treeRun.substance ?? {};

  add("tree.exists", tree.exists === true, tree.exists ? `tree on disk: ${tree.dir}` : `no tree at ${tree.dir ?? "(unset)"}`);
  add("tree.nonEmpty", (tree.fileCount ?? 0) > 0, `${tree.fileCount ?? 0} file(s)`);
  // The ENTRY requirement is kind-aware (W353): a `tool`/`library`/`service`
  // tree has no HTML by design, so demanding `index.html` there misreported a
  // legitimate product as failed. `tree.entry` is the kind-correct reading;
  // `tree.webEntry` is kept as the raw web sub-reading (additive).
  const entry = tree.entry ?? tree.webEntry;
  add(
    "tree.entry",
    entry?.ok === true,
    entry?.ok ? `entry (${entry.mode ?? "web"}): ${entry.entry ?? entry.html}` : entry?.detail ?? "no entry artifact",
  );
  add(
    "tree.declaredScripts",
    tree.declaredScripts?.ok === true,
    tree.declaredScripts?.ok
      ? `declared scripts: ${Object.keys(tree.declaredScripts.scripts ?? {}).join(", ")}`
      : `missing declared script(s): ${(tree.declaredScripts?.missing ?? []).join(", ") || "no package.json"}`,
  );
  add("treeRun.ok", treeRun.ok === true, treeRun.ok ? "tree-run green" : `tree-run red: ${treeRun.error ?? "unknown"}`);
  add("tree.typecheck.pass", treeRun.typecheck === "pass", `typecheck: ${treeRun.typecheck ?? "not run"}`);
  add("tree.test.pass", treeRun.test === "pass", `npm test: ${treeRun.test ?? "not run"}`);
  add(
    "tree.declaredScriptsVerified",
    treeRun.declaredScriptsVerified === true,
    treeRun.declaredScriptsVerified === true
      ? "declared typecheck/test executed over the tree's own bytes"
      : `declared scripts UNVERIFIED${treeRun.unverifiedDeclaredScripts?.length ? `: ${treeRun.unverifiedDeclaredScripts.join(", ")}` : ""}`,
  );
  add(
    "tree.substantive",
    (substance.real ?? 0) > 0 && (substance.stubs ?? 0) === 0,
    `substance stubs:${substance.stubs ?? 0} reexports:${substance.reexports ?? 0} real:${substance.real ?? 0}`,
  );
  add(
    "run.cleanSeal",
    run.status === "complete" && run.sealedWithFailures !== true,
    `status ${run.status ?? "?"} · phase ${run.currentPhase ?? "?"} · sealedWithFailures ${run.sealedWithFailures === true}` +
      (run.capped === true ? ` · capped at ${run.maxSteps ?? "?"} step(s) (incomplete, not a product failure)` : ""),
  );
  if (facts.install?.requested === true) {
    add("tree.install", facts.install.ok === true, facts.install.detail ?? "");
  }

  const failureReasons = assertions.filter((a) => !a.ok).map((a) => `${a.id}: ${a.detail}`);
  return { ok: assertions.every((a) => a.ok), assertions, failureReasons };
}

// ---------------------------------------------------------------------------
// Filesystem inspection of the emitted tree.
// ---------------------------------------------------------------------------
function walkFiles(root, base = "") {
  const out = [];
  let entries;
  try {
    entries = readdirSync(join(root, base), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walkFiles(root, rel));
    else if (e.isFile()) out.push(rel);
  }
  return out;
}

function inspectTree(dir, kind = null) {
  if (!existsSync(dir))
    return {
      exists: false,
      dir,
      kind: kind ?? null,
      fileCount: 0,
      files: [],
      webEntry: { ok: false, detail: `no tree at ${dir}` },
      entry: { ok: false, mode: kind ?? "web", detail: `no tree at ${dir}` },
      declaredScripts: { ok: false, missing: [] },
    };
  const files = walkFiles(dir);
  const has = (p) => files.includes(p);
  let pkg = {};
  let scripts = {};
  let missing = [];
  if (has("package.json")) {
    try {
      pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) ?? {};
      scripts = pkg.scripts ?? {};
    } catch {
      pkg = {};
      scripts = {};
    }
    missing = ["typecheck", "test"].filter((s) => typeof scripts[s] !== "string" || scripts[s].trim() === "");
  } else {
    missing = ["package.json"];
  }
  // Kind-aware entry: a web kind requires index.html + a src mount; a
  // tool/library/service kind requires its own program entry (W353).
  const entry = resolveTreeEntry(files, pkg, kind);
  const webEntry = resolveTreeEntry(files, pkg, undefined);
  // Banner state is READ OFF the emitted README, never inferred: the caution
  // marker alone is ambiguous (both a red-tree banner and a below-floor banner
  // use it), so the two headings are matched separately. `redBanner` stays the
  // pre-existing caution marker for envelope compatibility.
  let redBanner = false;
  let redTreeBanner = false;
  let belowFloorBanner = false;
  if (has("README.md")) {
    try {
      const readme = readFileSync(join(dir, "README.md"), "utf8");
      redBanner = readme.startsWith("> [!CAUTION]");
      redTreeBanner = readme.includes("RED TREE-RUN");
      belowFloorBanner = readme.includes("BELOW-FLOOR PLAN");
    } catch {
      /* unreadable README is not a banner */
    }
  }
  return {
    exists: true,
    dir,
    kind: kind ?? null,
    fileCount: files.length,
    files,
    entry,
    webEntry,
    declaredScripts: { ok: missing.length === 0, scripts, missing },
    redBanner,
    redTreeBanner,
    belowFloorBanner,
  };
}

/**
 * The honest below-floor / banner reading, assembled from BOTH the emit
 * envelope (what the writer itself recorded) and the emitted README (what
 * actually landed). A below-floor partial is never hidden: `belowFloor` is
 * true when the scaffold recorded `RT_E_PLAN_UNDERPRODUCED`, when the emitted
 * README carries the below-floor banner, or when the project's own journaled
 * floor seal is present. Pure; exported so the test can pin it.
 * @param {{ emit?: any; tree?: any }} [state]
 */
export function readBelowFloorState({ emit, tree } = {}) {
  const under = emit && typeof emit.underProduced === "object" && emit.underProduced !== null ? emit.underProduced : null;
  const recorded = under?.code === "RT_E_PLAN_UNDERPRODUCED";
  const banner = tree?.belowFloorBanner === true;
  return {
    belowFloor: recorded || banner,
    emittedBelowFloorBanner: banner,
    recordedUnderProduced: recorded,
    underProduced: under ? { code: under.code ?? "RT_E_PLAN_UNDERPRODUCED", detail: String(under.detail ?? "") } : null,
    redTreeBanner: tree?.redTreeBanner === true,
    cautionBanner: tree?.redBanner === true,
  };
}

function readSubstance(outcome) {
  const s = outcome?.substance;
  if (!s || typeof s !== "object") return { stubs: null, reexports: null, real: null, verdict: null };
  return { stubs: s.stubs ?? 0, reexports: s.reexports ?? 0, real: s.real ?? 0, verdict: s.verdict ?? null };
}

// ---------------------------------------------------------------------------
// Additive product-quality reading (`src/lib/product-quality.ts`, 2026-10-05).
//
// OPTIONAL BY DESIGN: the module is imported lazily and its ABSENCE is reported
// honestly, never fatal. The reading is attached to the payload as an EXTRA
// field and never feeds `evaluateAcceptance` — the harness's verdict rule (a
// red or stub-only tree is never ok:true) stays exactly as it was. The reading
// is byte-derived (web entry, pages/router, layout, ordering flow, module
// census) and is reported beside the verdict, never instead of it.
// ---------------------------------------------------------------------------
const PRODUCT_QUALITY_MODULE = "src/lib/product-quality.ts";

async function readProductQuality(project, emittedFiles) {
  let mod;
  try {
    mod = await import(pathToFileURL(join(REPO_ROOT, PRODUCT_QUALITY_MODULE)).href);
  } catch (err) {
    return {
      available: false,
      module: PRODUCT_QUALITY_MODULE,
      reason: `module unavailable: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  if (typeof mod.readProductQuality !== "function") {
    return { available: false, module: PRODUCT_QUALITY_MODULE, reason: "module present but exposes no readProductQuality export" };
  }
  try {
    // Pass the EMITTED files (with source) so the census scores what landed on
    // disk, exactly as the module union expects (`generatedTree` ∪ emittedFiles).
    const reading =
      Array.isArray(emittedFiles) && emittedFiles.length > 0
        ? mod.readProductQuality(project, { emittedFiles })
        : mod.readProductQuality(project);
    return { available: true, module: PRODUCT_QUALITY_MODULE, reader: "readProductQuality", reading };
  } catch (err) {
    return {
      available: false,
      module: PRODUCT_QUALITY_MODULE,
      reader: "readProductQuality",
      reason: `reading threw: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

/**
 * One brief, one full run. Returns the verdict object + the process exit code;
 * callers decide where it lands (single mode prints it, suite mode persists one
 * per brief). `opts.brief` overrides `--brief` (used by the suite), and
 * `opts.outDir` pins the run root (so a suite owns `<out>/<slug>/`).
 * @param {Record<string, any>} args
 * @param {{ brief?: string, outDir?: string }} [opts]
 * @returns {Promise<{ payload: any, code: number }>}
 */
async function runOne(args, opts = {}) {
  const briefValue = typeof opts.brief === "string" ? opts.brief : typeof args.brief === "string" ? args.brief : "";
  const briefSpec = readBriefSpec(briefValue);
  if (!briefSpec.ok) {
    return { payload: { ok: false, error: briefSpec.error, code: "RT_E_VALIDATION" }, code: 1 };
  }

  const keyed = !hasFlag(args, "keyless");
  if (!keyed) {
    // A `--keyless` run must be genuinely keyless. installRepoEnvKey() was
    // skipped, but an ambient process key stayed visible to the driver/codegen,
    // so keyed synthesis could spend under a keyless label. A present-but-blank
    // value is the repo's intentional-disable convention; also drop the declared
    // `.env` seam so `<cwd>/.env` cannot re-supply the key.
    process.env.DEEPSEEK_API_KEY = "";
    delete process.env.RAPIDTOOL_LLM_ENV_FILE;
  }
  const keyInfo = keyed ? await installRepoEnvKey() : { kind: "disabled-by-flag" };
  if (keyed && keyInfo.kind === "keyless") {
    return {
      payload: {
        ok: false,
        error: "keyed acceptance requested but no DEEPSEEK_API_KEY resolved (pass --keyless to run the deterministic floor)",
        code: "RT_E_LLM_NOT_CONFIGURED",
      },
      code: 1,
    };
  }

  const maxSteps = typeof args["max-steps"] === "string" && /^\d+$/.test(args["max-steps"]) ? parseInt(args["max-steps"], 10) : 40;
  const p6Retries = typeof args["p6-retries"] === "string" && /^\d+$/.test(args["p6-retries"]) ? parseInt(args["p6-retries"], 10) : 1;
  const installRequested = hasFlag(args, "install");

  const h = await import(pathToFileURL(join(REPO_ROOT, "src/lib/headless.ts")).href);

  const name = typeof args.name === "string" && args.name.trim() !== "" ? args.name.trim() : undefined;
  let project = h.createProject({ brief: briefSpec.brief, ...(name ? { name } : {}) });
  const slug = h.filename(project.name);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outRoot =
    typeof opts.outDir === "string" && opts.outDir.trim() !== ""
      ? resolve(process.cwd(), opts.outDir)
      : typeof args.out === "string" && args.out.trim() !== ""
        ? resolve(process.cwd(), args.out)
        : join(tmpdir(), "rapidtool-acceptance", `${slug}-${stamp}`);
  mkdirSync(outRoot, { recursive: true });
  const projectPath = join(outRoot, `${slug}.json`);
  const treeDir = join(outRoot, "emitted");
  h.saveProject(projectPath, project);

  // ---- drive the full pipeline (keyed by default) -------------------------
  const runOpts = {
    autopilot: true,
    live: keyed,
    machineGates: true,
    checkpointDir: dirname(projectPath),
    maxSteps,
  };
  let res = await h.runUntilGate(project, runOpts);
  project = res.project;
  let retries = 0;
  while (p6Retries > 0 && retries < p6Retries && typeof h.isRedRunningP6 === "function" && h.isRedRunningP6(project)) {
    retries += 1;
    project = h.retry(project);
    res = await h.runUntilGate(project, runOpts);
    project = res.project;
  }
  h.saveProject(projectPath, project);
  const runSummary = h.summary(project);

  // ---- emit the tree (banner policy so a red tree still lands honestly) ---
  const emit = await h.emitProject(project, treeDir, acceptanceEmitOptions());
  const tree = inspectTree(treeDir, project.kind ?? null);

  // ---- verify the tree's OWN declared toolchain ---------------------------
  /** @type {{ ok: boolean; typecheck: string; test: string; build?: string; declaredScriptsVerified: boolean; substance: { stubs: number|null; reexports: number|null; real: number|null; verdict?: string }; error: string|null; unverifiedDeclaredScripts: string[]; entrySmoke?: string|null; unverifiedEntry?: string|null; tests?: { pass: number; fail: number } }} */
  let treeRun = { ok: false, typecheck: "not run", test: "not run", declaredScriptsVerified: false, substance: { stubs: null, reexports: null, real: null }, error: null, unverifiedDeclaredScripts: [] };
  if (tree.exists) {
    try {
      const cc = await import(pathToFileURL(join(REPO_ROOT, "src/lib/compile-check.server.ts")).href);
      const outcome = await cc.treeRun(treeDir);
      const firstBadTest = (outcome.tests ?? []).find((t) => t.run !== "pass");
      // `declaredScriptsVerified` is read off the tree's own `project` sub-leg
      // (did `npm run typecheck` / `npm test` execute over the emitted bytes?).
      // The top-level flag also folds the kind-entry smoke, which is `skip` for
      // a webapp UI shell (not executable headless) — correct, but not what the
      // acceptance harness is asserting here.
      treeRun = {
        ok: outcome.ok === true,
        typecheck: outcome.project?.typecheck?.run ?? "not run",
        test: outcome.project?.test?.run ?? "not run",
        build: outcome.project?.build?.run ?? "not run",
        declaredScriptsVerified: outcome.project?.declaredScriptsVerified === true,
        unverifiedDeclaredScripts: outcome.unverifiedDeclaredScripts ?? [],
        entrySmoke: outcome.run?.run ?? null,
        unverifiedEntry: outcome.unverifiedEntry ?? null,
        substance: readSubstance(outcome),
        tests: {
          pass: (outcome.tests ?? []).reduce((n, t) => n + (t.tests?.pass ?? 0), 0),
          fail: (outcome.tests ?? []).reduce((n, t) => n + (t.tests?.fail ?? 0), 0),
        },
        error: outcome.ok === true ? null : outcome.error ?? (firstBadTest ? `${firstBadTest.file}: ${firstBadTest.run}` : "tree-run red"),
      };
    } catch (err) {
      treeRun.error = `tree-run seam unavailable: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  // ---- optional real `npm install` + declared scripts (opt-in, network) ---
  let install = { requested: installRequested, ok: false, detail: "not requested" };
  if (installRequested && tree.exists) {
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    const runNpm = (scriptArgs) =>
      spawnSync(npm, scriptArgs, { cwd: treeDir, encoding: "utf8", shell: false, timeout: 600_000 });
    const inst = runNpm(["install", "--no-audit", "--no-fund", "--ignore-scripts"]);
    if (inst.status !== 0) {
      install = { requested: true, ok: false, detail: `npm install failed (exit ${inst.status}): ${String(inst.stderr ?? "").slice(-400)}` };
    } else {
      const tc = runNpm(["run", "typecheck"]);
      const te = runNpm(["test"]);
      const ok = tc.status === 0 && te.status === 0;
      install = {
        requested: true,
        ok,
        typecheckExit: tc.status,
        testExit: te.status,
        detail: ok ? "npm install + npm run typecheck + npm test resolved and passed in the tree" : `npm install ok; typecheck exit ${tc.status}; test exit ${te.status}`,
      };
    }
  }

  const spend = typeof h.sessionSpendTotal === "function" ? h.sessionSpendTotal() : { tokens: null, calls: null };
  // Additive, optional reading — attached beside the verdict, never part of it.
  // The emitted files are read back from disk (with source) so the module
  // census scores the tree that actually landed.
  const emittedFiles = tree.exists
    ? tree.files.map((rel) => {
        try {
          return { path: rel, source: readFileSync(join(treeDir, rel), "utf8") };
        } catch {
          return { path: rel };
        }
      })
    : [];
  const productQuality = await readProductQuality(project, emittedFiles);
  // Additive below-floor/banner reading (W353): the writer's own recorded
  // `RT_E_PLAN_UNDERPRODUCED` seal + what the emitted README actually shows.
  // Reported beside the verdict; never rewritten into a pass.
  const belowFloor = readBelowFloorState({ emit, tree });
  let planUnderproduced = null;
  if (typeof h.planUnderproductionSeal === "function") {
    try {
      planUnderproduced = await h.planUnderproductionSeal(project);
    } catch (err) {
      planUnderproduced = { error: `plan-underproduction reading threw: ${err instanceof Error ? err.message : String(err)}` };
    }
  }
  const verdict = evaluateAcceptance({
    tree,
    treeRun,
    run: {
      status: runSummary.status,
      currentPhase: runSummary.currentPhase,
      sealedWithFailures: runSummary.sealedWithFailures === true,
      failedGates: runSummary.failedGates ?? [],
      steps: res.steps,
      maxSteps,
      outcome: res.outcome,
      // W353: a drive that stopped on its step bound is honestly INCOMPLETE —
      // named as `capped` so a green tree that ran out of steps is never read
      // as a product failure. It never flips `ok`.
      capped: res.outcome === "cap",
    },
    install,
  });

  const payload = {
    ok: verdict.ok,
    kind: "acceptance-run",
    keyed,
    keySource: keyInfo.kind,
    // Proof the label matched the run: a --keyless invocation blanks the key.
    keylessEnforced: keyed ? null : process.env.DEEPSEEK_API_KEY === "",
    brief: { source: briefSpec.source, chars: String(briefSpec.brief ?? "").length, frontmatterUnwrapped: briefSpec.frontmatterUnwrapped === true },
    project: {
      path: projectPath,
      name: project.name,
      status: runSummary.status,
      currentPhase: runSummary.currentPhase,
      sealedWithFailures: runSummary.sealedWithFailures === true,
      failedGates: (runSummary.failedGates ?? []).map((g) => ({ phase: g.phase, unmet: g.unmet })),
      steps: res.steps,
      maxSteps,
      outcome: res.outcome,
      capped: res.outcome === "cap",
      p6Retries: retries,
    },
    tree: {
      dir: treeDir,
      exists: tree.exists,
      kind: tree.kind ?? project.kind ?? null,
      fileCount: tree.fileCount,
      entry: tree.entry,
      webEntry: tree.webEntry,
      declaredScripts: tree.declaredScripts,
      redTreeBanner: tree.redBanner === true,
      // W353: the two banners are distinct and both are reported by name, so a
      // below-floor partial can never be read as a merely red-tree one (or vice
      // versa). `underProducedBanner` mirrors the emitted README heading.
      underProducedBanner: tree.belowFloorBanner === true,
      redTreeRunBanner: tree.redTreeBanner === true,
      emit: {
        ok: emit.ok === true,
        code: emit.code ?? null,
        underProduced: emit.underProduced ?? null,
        error: emit.ok ? null : String(emit.error ?? "").slice(0, 300),
      },
    },
    treeRun,
    install,
    // Additive gate readings (W353): the below-floor/banner state, the project's
    // own recorded plan-underproduction seal, and the product-quality reading —
    // all reported beside `ok`, none of them able to turn a red tree green.
    belowFloor,
    planUnderproduced,
    gates: {
      failed: (runSummary.failedGates ?? []).map((g) => ({ phase: g.phase, unmet: g.unmet })),
      sealedWithFailures: runSummary.sealedWithFailures === true,
      belowFloor: belowFloor.belowFloor,
      planUnderproduced: planUnderproduced && !planUnderproduced.error ? { code: planUnderproduced.code, floor: planUnderproduced.floor, emitted: planUnderproduced.emitted, modules: planUnderproduced.modules, missing: (planUnderproduced.missing ?? []).map((m) => m.path) } : null,
      productQuality: productQuality.available ? productQuality.reading?.quality === true : null,
    },
    // PR-31 additive machine-acceptance reading (`src/lib/acceptance.ts`),
    // lazily imported: an extra field that never changes `ok`. Absent module ⇒
    // `{ available: false, reason }`, reported honestly.
    productQuality,
    assertions: verdict.assertions,
    failureReasons: verdict.failureReasons,
    spend: { tokens: spend.tokens ?? null, calls: spend.calls ?? null, estimatedCostUsd: null },
    note: "honest verdict — ok:true requires a landed tree, the tree's own declared entry (index.html + a src mount for app/game; a bin/main or src entry otherwise), a green tree-run, and a verified declared toolchain; a red or stub-only tree is never ok. `productQuality`, `belowFloor` and `gates` are additive, byte-derived readings reported beside the verdict, never part of it",
  };
  return { payload, code: verdict.ok ? 0 : 1 };
}

function emitVerdict(payload, code) {
  const out = { schema_version: 1, cmd: "acceptance-run", ...payload, exit_code: code };
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
  process.exitCode = code;
  return code;
}

// ---------------------------------------------------------------------------
// Batch mode (W353): `--suite <dir-or-list>` runs MANY briefs sequentially,
// writes ONE verdict per brief under `--out/<slug>/verdict.json`, and prints a
// roll-up table. This is what makes the ten-brief validation one reproducible
// command instead of ten shell invocations. Honesty is unchanged: the suite is
// `ok` only when EVERY brief is `ok`, and each brief keeps its own failing
// reasons on disk (nothing is averaged away).
// ---------------------------------------------------------------------------

/** Resolve `--suite` to an ordered list of `{ spec, slug, source }`. A directory
 *  yields its `*.md`/`*.markdown`/`*.txt` files sorted; anything else is parsed
 *  as a `,`/`;`/newline-separated list of brief paths. Pure; exported for test.
 *  @param {string} spec
 *  @returns {{ ok: true, briefs: Array<{ spec: string, slug: string, source: string }> } | { ok: false, error: string }}
 */
export function resolveSuiteBriefs(spec) {
  if (typeof spec !== "string" || spec.trim() === "") {
    return { ok: false, error: "--suite is required (a directory of *.md briefs, or a comma-separated list of brief paths)" };
  }
  const raw = spec.trim();
  const asPath = resolve(process.cwd(), raw);
  let entries = [];
  if (existsSync(asPath)) {
    let st = null;
    try {
      st = statSync(asPath);
    } catch {
      st = null;
    }
    if (st?.isDirectory()) {
      entries = readdirSync(asPath)
        .filter((f) => /\.(md|markdown|txt)$/i.test(f))
        .sort()
        .map((f) => join(asPath, f));
      if (entries.length === 0) return { ok: false, error: `--suite ${raw}: no *.md/*.markdown/*.txt brief files in the directory` };
    } else if (st?.isFile()) {
      entries = [asPath];
    } else {
      return { ok: false, error: `--suite ${raw}: not a file or directory` };
    }
  } else {
    entries = raw
      .split(/[,;\r\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => resolve(process.cwd(), s));
    if (entries.length === 0) return { ok: false, error: `--suite ${raw}: not a directory and no brief paths parsed` };
  }
  const seen = new Set();
  const briefs = [];
  for (const p of entries) {
    const slug = basename(p).replace(/\.[^.]+$/, "");
    if (seen.has(slug)) continue; // one run per slug — never a silent duplicate
    seen.add(slug);
    briefs.push({ spec: p, slug, source: p });
  }
  return { ok: true, briefs };
}

function spendNow(h) {
  try {
    const s = h.sessionSpendTotal();
    return { tokens: typeof s.tokens === "number" ? s.tokens : 0, calls: typeof s.calls === "number" ? s.calls : 0 };
  } catch {
    return { tokens: 0, calls: 0 };
  }
}

/**
 * The spend a SINGLE brief bought — the ledger delta between two snapshots.
 * `sessionSpendTotal` is process-global, so a suite that reuses one process
 * must NOT persist the cumulative total as a brief's own cost (it would
 * attribute every earlier brief's tokens to the last one). Pure; exported so
 * the test can pin it. Never negative.
 * @param {{ tokens?: number, calls?: number }} before
 * @param {{ tokens?: number, calls?: number }} after
 */
export function spendDelta(before, after) {
  return {
    tokens: Math.max(0, (after?.tokens ?? 0) - (before?.tokens ?? 0)),
    calls: Math.max(0, (after?.calls ?? 0) - (before?.calls ?? 0)),
  };
}

/** One fixed-width human table row per brief; the machine-readable roll-up
 *  rides beside it in the JSON (`rollup.table` is this same text). */
export function formatRollupTable(rows) {
  const header = ["BRIEF", "OK", "EXIT", "STATUS", "P", "TREE", "SCRIPTS", "QUALITY", "FLOOR", "TOKENS"];
  const body = rows.map((r) => [
    String(r.slug),
    r.ok ? "yes" : "no",
    String(r.exitCode ?? "?"),
    String(r.status ?? "-"),
    String(r.currentPhase ?? "-"),
    String(r.treeFileCount ?? 0),
    r.treeRun?.declaredScriptsVerified ? "verified" : "no",
    r.gates?.productQuality === null || r.gates?.productQuality === undefined ? "n/a" : r.gates.productQuality ? "yes" : "no",
    r.belowFloor?.belowFloor ? "BELOW" : "ok",
    String(r.spend?.tokens ?? 0),
  ]);
  const all = [header, ...body];
  const width = header.map((_, i) => Math.max(...all.map((row) => String(row[i]).length)));
  const line = (row) => row.map((cell, i) => String(cell).padEnd(width[i])).join("  ").trimEnd();
  return [line(header), line(header.map(() => "-")), ...body.map(line)].join("\n");
}

async function runSuite(args) {
  const suite = resolveSuiteBriefs(typeof args.suite === "string" ? args.suite : "");
  if (!suite.ok) return emitVerdict({ ok: false, kind: "suite", error: suite.error, code: "RT_E_VALIDATION" }, 1);
  const outRoot =
    typeof args.out === "string" && args.out.trim() !== ""
      ? resolve(process.cwd(), args.out)
      : resolve(process.cwd(), "acceptance-suite");
  mkdirSync(outRoot, { recursive: true });
  // The per-brief runs own their own out dir; drop the suite-level selectors.
  const perBriefArgs = { ...args };
  delete perBriefArgs.suite;
  delete perBriefArgs.out;

  const h = await import(pathToFileURL(join(REPO_ROOT, "src/lib/headless.ts")).href);
  const startedAt = Date.now();
  const rows = [];
  for (const brief of suite.briefs) {
    const briefDir = join(outRoot, brief.slug);
    const before = spendNow(h);
    /** @type {{ payload: any, code: number }} */
    let outcome;
    try {
      outcome = await runOne(perBriefArgs, { brief: brief.spec, outDir: briefDir });
    } catch (err) {
      outcome = {
        payload: { ok: false, error: `suite brief ${brief.slug} threw: ${err instanceof Error ? err.message : String(err)}`, code: "RT_E_INTERNAL" },
        code: 4,
      };
    }
    const after = spendNow(h);
    const delta = spendDelta(before, after);
    /** @type {any} */
    const verdict = { schema_version: 1, cmd: "acceptance-run", ...outcome.payload, exit_code: outcome.code };
    // A persisted per-brief verdict must carry THIS brief's spend, not the
    // process-global cumulative total (W353): overwrite the runOne reading with
    // the measured delta and keep the cumulative beside it for reconciliation.
    verdict.spend = { tokens: delta.tokens, calls: delta.calls, estimatedCostUsd: null, processCumulative: { tokens: after.tokens, calls: after.calls } };
    try {
      mkdirSync(briefDir, { recursive: true });
      writeFileSync(join(briefDir, "verdict.json"), `${JSON.stringify(verdict, null, 2)}\n`, "utf8");
    } catch {
      /* an unwritable verdict path must not abort the suite — it is reported on the row */
    }
    rows.push({
      slug: brief.slug,
      source: brief.source,
      ok: verdict.ok === true,
      exitCode: outcome.code,
      status: verdict.project?.status ?? null,
      currentPhase: verdict.project?.currentPhase ?? null,
      steps: verdict.project?.steps ?? null,
      outcome: verdict.project?.outcome ?? null,
      capped: verdict.project?.capped === true,
      treeExists: verdict.tree?.exists === true,
      treeFileCount: verdict.tree?.fileCount ?? 0,
      treeEntry: verdict.tree?.entry ?? null,
      treeRun: verdict.treeRun ?? { ok: false, declaredScriptsVerified: false },
      gates: verdict.gates ?? null,
      belowFloor: verdict.belowFloor ?? { belowFloor: false },
      emitCode: verdict.tree?.emit?.code ?? null,
      productQuality: verdict.gates?.productQuality ?? null,
      spend: delta,
      failureReasons: Array.isArray(verdict.failureReasons) ? verdict.failureReasons : [],
      verdictPath: join(briefDir, "verdict.json"),
    });
  }
  const total = {
    tokens: rows.reduce((n, r) => n + (r.spend.tokens ?? 0), 0),
    calls: rows.reduce((n, r) => n + (r.spend.calls ?? 0), 0),
  };
  const allGreen = rows.length > 0 && rows.every((r) => r.ok);
  const table = formatRollupTable(rows);
  // The table is written to stderr so stdout stays exactly one JSON object
  // (the harness's machine contract); the same text is in `rollup.table`.
  try {
    process.stderr.write(`${table}\n`);
  } catch {
    /* stderr unusable — the table is still on the JSON */
  }
  const payload = {
    ok: allGreen,
    kind: "suite",
    keyed: !hasFlag(args, "keyless"),
    suite: { source: typeof args.suite === "string" ? args.suite : null, outRoot, briefs: rows.length, wallMs: Date.now() - startedAt },
    rollup: {
      total: rows.length,
      ok: rows.filter((r) => r.ok).length,
      failed: rows.filter((r) => !r.ok).length,
      // Honest sub-tallies — a below-floor tree is counted, never hidden.
      belowFloor: rows.filter((r) => r.belowFloor?.belowFloor === true).length,
      productQuality: rows.filter((r) => r.productQuality === true).length,
      declaredScriptsVerified: rows.filter((r) => r.treeRun?.declaredScriptsVerified === true).length,
      spend: { tokens: total.tokens, calls: total.calls, estimatedCostUsd: null },
      table,
    },
    briefs: rows,
    note: "suite roll-up — `ok:true` requires EVERY brief green; each brief keeps its own verdict.json (with its own failureReasons) under `outRoot`. `belowFloor`/`productQuality` are additive readings, never averaged into `ok`.",
  };
  return emitVerdict(payload, allGreen ? 0 : 1);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.suite !== undefined) return runSuite(args);
  const outcome = await runOne(args, {});
  return emitVerdict(outcome.payload, outcome.code);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    emitVerdict({ ok: false, error: `acceptance-run internal error: ${err instanceof Error ? err.stack ?? err.message : String(err)}`, code: "RT_E_INTERNAL" }, 4);
  });
}
