#!/usr/bin/env node
/**
 * fixes/144 (M6, lane D4) + fixes/147 (Wave E, lane E3) — run-eval.mjs: the
 * maker-loop eval driver.
 *
 * For every corpus fixture present under research/eval-corpus/<slug>.md:
 *   create → drive the FULL pipeline (keyless deterministic floor by default;
 *   `--keyed` + DEEPSEEK_API_KEY = one bounded live entry) with stock-HITL
 *   approvals via the driver → emit to research/eval-out/<slug>/ → tree-run →
 *   score with the pure maker rubric (src/lib/maker-score.ts) → print a table
 *   and persist research/eval-out/results.json (+ history.json for M7 priors).
 *
 * SINGLE-SYNTHESIS KEYED FLOW (fixes/147 E3, divergence #4 closure): a keyed
 * run no longer drains live:true (a drain-side P6 synthesis) and THEN lets
 * driveP6Journey re-synthesize. Instead the drain runs keyless/floor only to
 * the P6 gate (approve P4/P5; phase 6 left ready), driveP6Journey runs THE one
 * keyed synthesis (budget JOURNEY_BUDGET cycles; the verdict scores M3/M8),
 * and the drain resumes from P7 keyless to a terminal state. Emit + treeRun
 * happen ONCE at the end. Keyless mode is unchanged (the floor regression).
 *
 * M1 CAPABILITY-COVERAGE REPORT (fixes/147 E3, divergence #1 signal): every
 * entry persists its coverage map ({capability → tree file paths} + missing),
 * computed here from corpus expectedCapabilities + the final project tree via
 * maker-score's pure probes. When a KEYED journey CONVERGED but M1=0 — a
 * converged run that shipped no identifier for a demanded capability — the
 * missing list is printed LOUDLY. maker-score stays pure: it only exposes the
 * probes; the driver owns the report.
 *
 * RUN-SIDE GRADERS + TRIALS/pass@k (W5-L5 T-107.5, `wave_plans/W5/lane-5.md`; steal #5/#8 of
 * `research/multiagent/107_competitors_agentic.md`). The per-case acceptance bar is NOT
 * taken from the agent-writable corpus fixture anymore: it lives in a run-side grader file
 * `research/eval-corpus/graders/<slug>.grader.json`, read ONLY by this driver. Graders are
 * never handed to createProject/emitProject and never copied into the emit dir, so the
 * emitted tree can neither read nor game them — and every emitted tree is scanned for grader
 * leaks at emit time (`graderLeakScan`, pinned by scripts/run-eval.test.mjs). Each case is
 * run `--trials=N` times (default 1 = the legacy single-run contract) in a FRESH project per
 * trial; the honest metrics per case are pass@k / pass^k / flakiness (a case that flips
 * between trials is FLAKY, never averaged into a fabricated pass). A case with no valid
 * run-side grader is SKIPPED with a reason — never graded against an undeclared bar.
 *
 * Results are DATA, not failures: the script exits 0 always (missing corpus
 * dir, unparseable entries, red scores — all printed and recorded, never
 * thrown as process failures). Keyless = the honest regression leg.
 *
 * Run: npm run eval            (keyless)
 *      npm run eval -- --keyed (one bounded keyed entry when the key is set)
 *      npm run eval -- --trials=3 [--all|--limit=N]   (trials + pass@k)
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createProject,
  runUntilGate,
  approve,
  driveP6Journey,
  emitProject,
} from "../src/lib/headless.ts";
import { treeRun } from "../src/lib/compile-check.server.ts";
import { scoreMaker, capabilityCoverage, treeFilesOf } from "../src/lib/maker-score.ts";
import { fnv1a } from "../src/lib/algorithms.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
/** Corpus dir honors EVAL_CORPUS_DIR (isolated scratch runs for lane proof /
 *  future keyed experiments) — default is D3's research/eval-corpus. */
const CORPUS_DIR = process.env.EVAL_CORPUS_DIR ? resolve(process.env.EVAL_CORPUS_DIR) : join(ROOT, "research", "eval-corpus");
/** Eval output honors EVAL_OUT_DIR (keeps scratch runs out of the real
 *  results/history used for M7 priors). */
const OUT_DIR = process.env.EVAL_OUT_DIR ? resolve(process.env.EVAL_OUT_DIR) : join(ROOT, "research", "eval-out");
const RESULTS_PATH = join(OUT_DIR, "results.json");
const HISTORY_PATH = join(OUT_DIR, "history.json");
/** RUN-SIDE GRADER DIR (W5-L5 / T-107.5). Per-case acceptance bars live in
 *  `<corpus>/graders/<slug>.grader.json` — run-side files read ONLY by this
 *  driver (EVAL_GRADER_DIR overrides for scratch/test corpora). They are never
 *  passed to createProject/emitProject and never written under OUT_DIR, so the
 *  emitted tree cannot read them; every emitted tree is additionally scanned
 *  for grader leaks after emit (`graderLeakScan`). */
const GRADER_DIR = process.env.EVAL_GRADER_DIR ? resolve(process.env.EVAL_GRADER_DIR) : join(CORPUS_DIR, "graders");

const JOURNEY_BUDGET = 3;
const KEYED = process.argv.includes("--keyed");
const KEYED_OK = KEYED && Boolean(process.env.DEEPSEEK_API_KEY);
const EVAL_ALL = process.argv.includes("--all");
const LIMIT_ARG = process.argv.find((a) => a.startsWith("--limit="));
const EVAL_LIMIT = LIMIT_ARG ? Number(LIMIT_ARG.slice("--limit=".length)) : NaN;
/** W5-L5 T-107.5 — trials per corpus case. Default 1 keeps the legacy
 *  single-run contract byte-identical (pass@1 == the one observed trial);
 *  `--trials=N` (2..MAX_TRIALS) enables pass@k + flakiness accounting. An
 *  invalid value falls back to 1 with an honest note below, never a throw. */
const MAX_TRIALS = 9;
const TRIALS_ARG = process.argv.find((a) => a.startsWith("--trials="));
const TRIALS_REQUESTED = TRIALS_ARG ? Number(TRIALS_ARG.slice("--trials=".length)) : 1;
const TRIALS =
  Number.isFinite(TRIALS_REQUESTED) && TRIALS_REQUESTED >= 1
    ? Math.min(Math.floor(TRIALS_REQUESTED), MAX_TRIALS)
    : 1;
/** Which k the reported pass@k uses (additive `--k=N`; default 1 = the
 *  standard single-trial success probability). pass@k with k = n is trivially
 *  1 whenever any trial passed — the honest small-k / pass^n pair is what
 *  separates "solved it once" from "solves it reliably". */
const K_ARG = process.argv.find((a) => a.startsWith("--k="));
const K_REQUESTED = K_ARG ? Number(K_ARG.slice("--k=".length)) : 1;
const K = Number.isFinite(K_REQUESTED) && K_REQUESTED >= 1 ? Math.floor(K_REQUESTED) : 1;

// ---------------------------------------------------------------------------
// Corpus frontmatter (tolerant, zero-dep: scalars / quoted / | block / lists).
// The schema is D3's cross-lane contract: name/brief/kind/domain/
// expectedNouns/expectedCapabilities/acceptance/baseline.
// ---------------------------------------------------------------------------

function unquote(s) {
  const t = s.trim();
  if (t.length >= 2) {
    const q = t[0];
    if ((q === '"' || q === "'") && t.endsWith(q)) return t.slice(1, -1).replace(/\\n/g, "\n");
  }
  return t;
}

/** Split a bracket-list body on commas that are NOT inside a double-quoted
 *  string. Corpus fixtures write `expectedCapabilities: ["A, with commas",
 *  "B"]` — a naive split(",") fragments quoted capability text (7 real
 *  capabilities became 32 pseudo-caps in M1/coverage evidence). YAML block
 *  lists (`- item` lines) never pass through here; only inline `[...]`. */
function splitListRespectingQuotes(s) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (const ch of s) {
    if (ch === '"') inQ = !inQ;
    if (ch === "," && !inQ) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  const last = cur.trim();
  if (last.length > 0) out.push(last);
  return out;
}

function parseFrontmatter(raw) {
  const out = {};
  const lines = raw.split(/\r?\n/);
  let i = 0;
  let key = null;
  let mode = null; // null | block | list
  let acc = [];
  while (i < lines.length) {
    const line = lines[i];
    if (mode === "block") {
      if (/^\s/.test(line) || line.trim() === "") {
        acc.push(line);
        i += 1;
        continue;
      }
      out[key] = acc.join("\n").trim();
      mode = null;
      key = null;
      continue;
    }
    if (mode === "list") {
      const m = line.match(/^\s*-\s+(.*)$/);
      if (m) {
        out[key].push(unquote(m[1]));
        i += 1;
        continue;
      }
      mode = null;
      key = null;
      continue;
    }
    const m = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (m) {
      key = m[1];
      const rest = m[2].trim();
      if (rest === "|" || rest === ">") {
        mode = "block";
        acc = [];
        out[key] = "";
      } else if (rest === "" || rest === "[]") {
        mode = "list";
        out[key] = [];
      } else if (rest.startsWith("[") && rest.endsWith("]")) {
        out[key] = splitListRespectingQuotes(rest.slice(1, -1))
          .map(unquote)
          .filter((x) => x.length > 0);
      } else {
        out[key] = unquote(rest);
      }
    }
    i += 1;
  }
  if (mode === "block" && key) out[key] = acc.join("\n").trim();
  return out;
}

/** One corpus entry: frontmatter + file-derived slug + the raw text body. */
function loadCorpusEntry(file) {
  const text = readFileSync(join(CORPUS_DIR, file), "utf8");
  const slug = basename(file, ".md");
  const body = text.startsWith("---") ? text.replace(/^---[\s\S]*?---\s*/, "").trim() : text;
  const fm = text.startsWith("---") ? parseFrontmatter(text.slice(3, text.indexOf("\n---", 3))) : {};
  const strList = (v) => {
    if (Array.isArray(v)) return v.filter((x) => typeof x === "string" && x.trim()).map((s) => s.trim());
    if (typeof v === "string" && v.trim()) return [v.trim()];
    return [];
  };
  const brief = typeof fm.brief === "string" && fm.brief.trim() ? fm.brief.trim() : body;
  return {
    slug,
    file,
    name: typeof fm.name === "string" && fm.name.trim() ? fm.name.trim() : slug,
    brief,
    kind: typeof fm.kind === "string" && fm.kind.trim() ? fm.kind.trim() : "",
    domain: typeof fm.domain === "string" && fm.domain.trim() ? fm.domain.trim() : "",
    expectedNouns: strList(fm.expectedNouns),
    expectedCapabilities: strList(fm.expectedCapabilities),
    acceptance: strList(fm.acceptance),
    baseline: fm.baseline !== undefined && fm.baseline !== null ? String(fm.baseline) : "—",
    raw: fm,
  };
}

function listCorpusEntries() {
  if (!existsSync(CORPUS_DIR)) return [];
  return readdirSync(CORPUS_DIR, "utf8")
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => {
      // Only frontmatter-carrying files are fixtures — corpus documentation
      // (e.g. D3's README.md) is not an entry to evaluate.
      try {
        const text = readFileSync(join(CORPUS_DIR, f), "utf8");
        if (!text.startsWith("---")) {
          return { entry: null, error: `${f}: not a corpus fixture (no YAML frontmatter fence) — skipped as documentation` };
        }
        return { entry: loadCorpusEntry(f), error: null };
      } catch (e) {
        return { entry: null, error: `${f}: ${e instanceof Error ? e.message : String(e)}` };
      }
    });
}

// ---------------------------------------------------------------------------
// Run-side graders (W5-L5 / T-107.5): the acceptance bar, frozen OUTSIDE the
// agent-writable corpus fixture and outside the emitted tree.
//
// A grader file (`<GRADER_DIR>/<slug>.grader.json`) is the grading source of
// truth for its case: acceptance bar text, required identifiers, required
// capabilities, run-side file/content assertions (SWE-agent-style
// expectedFiles / expectedContent, 107 §8) and the pass threshold. The corpus
// frontmatter keeps its copies as the documented D3 schema; this driver no
// longer grades from them (`scoringCorpusFor` pins that in the tests).
// ---------------------------------------------------------------------------

/** Path of the run-side grader for one corpus slug. */
export function graderFileFor(slug, graderDir = GRADER_DIR) {
  return join(graderDir, `${slug}.grader.json`);
}

/** Parse + validate one grader document text. Returns `{ ok: true, grader }`
 *  or `{ ok: false, error }` — a grader that cannot be trusted never grades. */
export function parseGrader(raw, slug) {
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch (e) {
    return { ok: false, error: `unparseable grader JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return { ok: false, error: "grader is not a JSON object" };
  const strList = (v) =>
    Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim().length > 0).map((s) => s.trim()) : null;
  const bar = typeof doc.acceptanceBar === "string" ? doc.acceptanceBar.trim() : "";
  if (bar.length === 0) return { ok: false, error: "grader carries no acceptanceBar (never grade against an undeclared bar)" };
  const identifiers = strList(doc.requiredIdentifiers);
  if (identifiers === null) return { ok: false, error: "requiredIdentifiers must be a string array" };
  const capabilities = strList(doc.requiredCapabilities);
  if (capabilities === null) return { ok: false, error: "requiredCapabilities must be a string array" };
  const pw = doc.passWhen && typeof doc.passWhen === "object" ? doc.passWhen : {};
  const meanAtLeast = typeof pw.meanAtLeast === "number" && pw.meanAtLeast > 0 && pw.meanAtLeast <= 1 ? pw.meanAtLeast : 1;
  const expectedFiles = strList(doc.expectedFiles) ?? [];
  const expectedContent = Array.isArray(doc.expectedContent)
    ? doc.expectedContent
        .filter((c) => c && typeof c.file === "string" && typeof c.contains === "string")
        .map((c) => ({ file: c.file, contains: c.contains }))
    : [];
  const graderSlug = typeof doc.slug === "string" && doc.slug.trim() ? doc.slug.trim() : slug;
  if (slug && graderSlug !== slug) {
    return { ok: false, error: `grader slug "${graderSlug}" does not match corpus slug "${slug}"` };
  }
  return {
    ok: true,
    grader: {
      slug: graderSlug,
      graderVersion: typeof doc.graderVersion === "number" ? doc.graderVersion : 1,
      caseName: typeof doc.caseName === "string" ? doc.caseName : "",
      authority: typeof doc.authority === "string" ? doc.authority : "",
      movedFrom: typeof doc.movedFrom === "string" ? doc.movedFrom : "",
      acceptanceBar: bar,
      requiredIdentifiers: identifiers,
      requiredCapabilities: capabilities,
      expectedFiles,
      expectedContent,
      passWhen: {
        meanAtLeast,
        requireExpectedFiles: pw.requireExpectedFiles !== false,
        requireExpectedContent: pw.requireExpectedContent !== false,
      },
    },
  };
}

/** Load + validate the run-side grader for one slug. `{ ok:false, error }`
 *  carries the honest skip reason (missing file, bad JSON, undeclared bar). */
export function loadGrader(slug, graderDir = GRADER_DIR) {
  const path = graderFileFor(slug, graderDir);
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return { ok: false, path, error: `no run-side grader at ${path} — case SKIPPED (never graded against an undeclared bar)` };
  }
  const parsed = parseGrader(raw, slug);
  if (!parsed.ok) return { ok: false, path, error: `run-side grader ${path} rejected: ${parsed.error} — case SKIPPED` };
  return { ok: true, path, grader: parsed.grader };
}

/** Split corpus entries into runnable `{entry, grader}` targets and honest
 *  skips. `graderFor(slug)` is injected so the plan is pure + testable. */
export function planTargets(entries, graderFor) {
  const targets = [];
  const skips = [];
  for (const entry of entries) {
    const g = graderFor(entry.slug);
    if (!g || g.ok !== true) {
      skips.push({ slug: entry.slug, kind: "no-grader", reason: g ? g.error : "no grader resolver" });
      continue;
    }
    targets.push({ entry, grader: g.grader, graderPath: g.path });
  }
  return { targets, skips };
}

/** The corpus object handed to scoreMaker: identifiers + capabilities come
 *  from the RUN-SIDE grader only (the frontmatter copies are documentation). */
export function scoringCorpusFor(entry, grader) {
  return {
    kind: entry.kind,
    brief: entry.brief,
    expectedNouns: grader.requiredIdentifiers,
    expectedCapabilities: grader.requiredCapabilities,
  };
}

// ---------------------------------------------------------------------------
// History (M7 prior evidence) + helpers.
// ---------------------------------------------------------------------------

function readJson(path, fallback) {
  try {
    if (existsSync(path)) return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    /* corrupt/missing history is not a failure — start fresh */
  }
  return fallback;
}

function priorFor(slug) {
  const history = readJson(HISTORY_PATH, []);
  const same = history.filter((h) => h && h.slug === slug);
  if (same.length === 0) return null;
  const last = same[same.length - 1];
  return { m1: last.m1 ?? 0, m2: last.m2 ?? 0, m3: last.m3 ?? 0 };
}

function domainMatch(entry, project) {
  const d = entry.domain;
  if (!d) return null; // no domain declared — nothing to match
  const hay = `${project.brief ?? ""} ${project.domain ?? ""}`.toLowerCase();
  const tokens = d.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1);
  if (tokens.length === 0) return null;
  return tokens.every((t) => hay.includes(t)) ? 1 : 0;
}

function treeRunToEvidence(outcome) {
  if (!outcome || typeof outcome !== "object") return null;
  const specPass = Array.isArray(outcome.tests)
    ? outcome.tests.reduce((a, v) => a + (v && v.tests && typeof v.tests.pass === "number" ? v.tests.pass : 0), 0)
    : 0;
  const specFail = Array.isArray(outcome.tests)
    ? outcome.tests.reduce((a, v) => a + (v && v.tests && typeof v.tests.fail === "number" ? v.tests.fail : 0), 0)
    : 0;
  let detail =
    typeof outcome.error === "string"
      ? outcome.error
      : typeof outcome.detail === "string"
        ? outcome.detail
        : undefined;
  if (!detail && Array.isArray(outcome.tests)) {
    const firstFail = outcome.tests.find((v) => v && (v.run === "fail" || (v.tests && v.tests.fail > 0)));
    if (firstFail && typeof firstFail.detail === "string") {
      detail = `spec ${firstFail.file} failed: ${firstFail.detail.slice(0, 220)}`;
    }
  }
  return {
    ok: outcome.ok === true,
    dir: typeof outcome.dir === "string" ? outcome.dir : "",
    compileOk: outcome.compile ? outcome.compile.ok === true : outcome.ok === true,
    testsPass: specPass,
    testsFail: specFail,
    detail,
  };
}

// ---------------------------------------------------------------------------
// Trials, pass@k / pass^k / flakiness + the grader leak scan (W5-L5 T-107.5).
// All pure except `checkAcceptance` / `treeTextFiles` / `graderLeakScan`,
// which only read files. Nothing here writes into an emitted tree.
// ---------------------------------------------------------------------------

const round4 = (x) => Math.round(x * 10_000) / 10_000;

/** Binomial coefficient C(n, k); 0 when out of range. Exact for the small n
 *  this driver sees (trials ≤ 9) because the float product is rounded back. */
export function choose(n, k) {
  if (!Number.isInteger(n) || !Number.isInteger(k) || n < 0 || k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i += 1) r = (r * (n - k + i)) / i;
  return Math.round(r);
}

/** pass@k (OpenAI human-eval reading, 107 §5): P(at least 1 of k trials passes),
 *  estimated from the observed n trials with c passes as 1 - C(n-c,k)/C(n,k).
 *  `null` when the inputs are not a real trial record (never a fabricated 0). */
export function passAtK(n, c, k = n) {
  if (!Number.isInteger(n) || n < 1) return null;
  if (!Number.isInteger(c) || c < 0 || c > n) return null;
  const kk = Math.min(Math.max(1, Math.floor(Number.isFinite(k) ? k : n)), n);
  const denom = choose(n, kk);
  if (denom === 0) return null;
  return round4(1 - choose(n - c, kk) / denom);
}

/** pass^k: P(all k of the k trials pass), estimated as C(c,k)/C(n,k) — the
 *  reliability bar ("solves it reliably", not "solved it once"). */
export function passCaretK(n, c, k = n) {
  if (!Number.isInteger(n) || n < 1) return null;
  if (!Number.isInteger(c) || c < 0 || c > n) return null;
  const kk = Math.min(Math.max(1, Math.floor(Number.isFinite(k) ? k : n)), n);
  const denom = choose(n, kk);
  if (denom === 0) return null;
  return round4(choose(c, kk) / denom);
}

/** Honest trials accounting for one case: a case that flips between trials is
 *  FLAKY (never averaged into a pass). With 1 trial flakiness is not measurably
 *  zero — it is UNMEASURABLE, and the block says so. */
export function trialsSummary(outcomes, opts = {}) {
  const list = Array.isArray(outcomes) ? outcomes.map((o) => o === true) : [];
  const n = list.length;
  const c = list.filter(Boolean).length;
  // Default k = 1 (single-trial success probability). k is clamped to the
  // observed trial count and BOTH are reported — never a silent substitution.
  const kRequested = Number.isFinite(opts.k) && opts.k >= 1 ? Math.floor(opts.k) : 1;
  if (n === 0) {
    return {
      trials: 0,
      passes: 0,
      failed: 0,
      k: null,
      kEffective: null,
      passAt1: null,
      passAtK: null,
      passAllTrials: null,
      observedPassRate: null,
      flaky: null,
      flakinessMeasurable: false,
      note: "no trials recorded",
    };
  }
  const k = Math.min(Math.max(1, kRequested), n);
  return {
    trials: n,
    passes: c,
    failed: n - c,
    k: kRequested,
    kEffective: k,
    passAt1: round4(c / n),
    passAtK: passAtK(n, c, k),
    passAllTrials: passCaretK(n, c, n),
    observedPassRate: round4(c / n),
    flaky: n >= 2 ? c > 0 && c < n : false,
    flakinessMeasurable: n >= 2,
    note: n >= 2 ? null : "1 trial — flakiness unmeasurable (pass@1 only; use --trials=N ≥ 2)",
  };
}

/** Run-side acceptance assertions (107 §8 steal): the grader's declared
 *  expectedFiles / expectedContent checked against the EMITTED tree by the
 *  driver — declared before the run, applied from outside the tree. */
export function checkAcceptance(grader, emittedDir, emittedFiles) {
  const files = Array.isArray(emittedFiles) ? emittedFiles.map((f) => String(f).replace(/\\/g, "/")) : [];
  const missingFiles = [];
  if (grader.passWhen.requireExpectedFiles) {
    for (const want of grader.expectedFiles) {
      const hit = files.some((f) => f === want || f.endsWith(`/${want}`));
      if (!hit) missingFiles.push(want);
    }
  }
  const failedContent = [];
  if (grader.passWhen.requireExpectedContent) {
    for (const want of grader.expectedContent) {
      const rel = files.find((f) => f === want.file || f.endsWith(`/${want.file}`));
      if (!rel) {
        failedContent.push(`${want.file}: file absent`);
        continue;
      }
      let text = "";
      try {
        const st = statSync(join(emittedDir, rel));
        text = st.size <= 2_000_000 ? readFileSync(join(emittedDir, rel), "utf8") : "";
      } catch {
        text = "";
      }
      if (!text.includes(want.contains)) failedContent.push(`${want.file}: missing ${JSON.stringify(want.contains)}`);
    }
  }
  return {
    filesOk: missingFiles.length === 0,
    missingFiles,
    contentOk: failedContent.length === 0,
    failedContent,
    checked: { expectedFiles: grader.expectedFiles.length, expectedContent: grader.expectedContent.length },
  };
}

/** Path of one trial's emit dir. 1 trial = the legacy `<out>/<slug>/` path
 *  (byte-identical for every existing consumer); N > 1 trials emit to FRESH
 *  sibling workspaces `<out>/<slug>--trial-<i>/` so no trial can inherit
 *  another's tree. */
export function trialEmitDir(outDir, slug, trial, trials) {
  return trials <= 1 ? join(outDir, slug) : join(outDir, `${slug}--trial-${trial}`);
}

const LEAK_SKIP_DIRS = new Set(["node_modules", ".git"]);

/** Every text file of an emitted tree (relative posix paths), bounded. */
export function treeTextFiles(dir, opts = {}) {
  const maxFiles = Number.isFinite(opts.maxFiles) ? opts.maxFiles : 500;
  const maxBytes = Number.isFinite(opts.maxBytes) ? opts.maxBytes : 512 * 1024;
  const out = [];
  const walk = (abs, rel) => {
    if (out.length >= maxFiles) return;
    let names;
    try {
      names = readdirSync(abs, "utf8");
    } catch {
      return;
    }
    for (const name of names) {
      if (out.length >= maxFiles) return;
      if (LEAK_SKIP_DIRS.has(name)) continue;
      const absChild = join(abs, name);
      const relChild = rel ? `${rel}/${name}` : name;
      let st;
      try {
        st = statSync(absChild);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        walk(absChild, relChild);
        continue;
      }
      if (!st.isFile() || st.size > maxBytes) continue;
      let text;
      try {
        text = readFileSync(absChild, "utf8");
      } catch {
        continue;
      }
      if (text.includes("\u0000")) continue; // binary
      out.push(relChild);
    }
  };
  walk(dir, "");
  return out;
}

/** The strings a run-side grader must never leave inside an emitted tree:
 *  its acceptance bar and its own path/file name. (Required identifiers /
 *  capabilities are NOT markers — the tree is supposed to contain them.) */
export function graderLeakMarkers(grader) {
  const markers = [];
  const bar = typeof grader.acceptanceBar === "string" ? grader.acceptanceBar.trim() : "";
  if (bar.length >= 24) markers.push({ label: "acceptanceBar", text: bar });
  markers.push({ label: "graderPath", text: `eval-corpus/graders/${grader.slug}.grader.json` });
  markers.push({ label: "graderFile", text: `${grader.slug}.grader.json` });
  return markers;
}

/** Scan an emitted tree for grader leaks. The emitted project must not be able
 *  to read or reference its run-side grader; `leaked === true` is recorded
 *  loudly in the run evidence, never silently swallowed. */
export function graderLeakScan(emittedDir, grader, opts = {}) {
  const markers = graderLeakMarkers(grader);
  const files = treeTextFiles(emittedDir, opts);
  const hits = [];
  for (const file of files) {
    let text;
    try {
      text = readFileSync(join(emittedDir, file), "utf8");
    } catch {
      continue;
    }
    for (const m of markers) {
      if (text.includes(m.text)) hits.push({ file, marker: m.label });
    }
  }
  return { scanned: files.length, markers: markers.map((m) => m.label), hits, leaked: hits.length > 0 };
}

/** Honest mode notices: what a keyless run does NOT do (and what a `--keyed`
 *  request degrades into without the key). Structurally key-free — only
 *  booleans enter, so the key value can never be printed. */
export function keylessSkipNotices({ keyedRequested, hasKey }) {
  const notices = [];
  if (keyedRequested && !hasKey) {
    notices.push("--keyed requested but DEEPSEEK_API_KEY is unset — falling back to the keyless floor (the key value is never read into any output and never printed)");
  }
  if (!hasKey) {
    notices.push("keyless floor: no model calls and no live synthesis — M1..M4 score the deterministic scaffold + the P6 floor journey; no language-model claim is made and no model text is fabricated");
  }
  if (keyedRequested && !hasKey) {
    notices.push("keyed-only stages SKIPPED (not failed, not faked): live P6 synthesis + keyed journey verdict");
  }
  return notices;
}

// ---------------------------------------------------------------------------
// The drain: full pipeline with stock-HITL approvals via the driver.
// ---------------------------------------------------------------------------

/** Drive the pipeline to a terminal state — or, with `p6Gate: true`, to the
 *  P6 live edge — approving every parked HITL gate under the harness's
 *  autopilot seat (216 TA-2: `approve()` never mints `decidedBy:"human"` for a
 *  machine path; a forceHuman gate therefore STALLS the drain honestly instead
 *  of being overridden by a fabricated human actor), bounded by hard
 *  iteration guards. Returns the terminal RunResult + whether the drain stopped
 *  on time + the park position.
 *
 * `p6Gate` (fixes/147 E3, single-synthesis keyed flow): P5 is the last stock
 * HITL phase before P6, so approving the P5 gate leaves phase 6 READY with
 * priors sealed — the exact P6 live edge driveP6Journey expects. Stopping the
 * FLOOR drain there means the journey is the ONLY phase-6 synthesis (the old
 * keyed flow ran the whole drain live:true — synthesis #1 inside the drain —
 * and then let the journey re-synthesize #2; fixes/146 §2 divergence #4). */
async function drainPipeline(project, { keyed, p6Gate = false } = {}) {
  let p = project;
  let lastRes = null;
  const approved = [];
  const rounds = 80;
  for (let i = 0; i < rounds; i += 1) {
    const res = await runUntilGate(p, { autopilot: false, live: keyed, maxSteps: 60 });
    p = res.project;
    lastRes = res;
    if (res.outcome === "hitl") {
      const gatePhase = p.hitl && typeof p.hitl.phase === "number" ? p.hitl.phase : null;
      try {
        p = approve(p);
        approved.push(`P${gatePhase}`);
      } catch (e) {
        // A stale/phantom gate that cannot be approved = a stalled run. Stop
        // loudly with a code instead of spinning silently (M9).
        return {
          p,
          res,
          approved,
          onTime: false,
          stall: e instanceof Error ? e.message : String(e),
          position: "stalled",
        };
      }
      if (p6Gate && gatePhase === 5) {
        return { p, res, approved, onTime: true, stall: null, position: "p6-gate" };
      }
      continue;
    }
    if (res.outcome === "complete" || res.outcome === "blocked" || res.outcome === "error") {
      return { p, res, approved, onTime: true, stall: null, position: "terminal" };
    }
    // progress/cap — keep looping under the round guard.
  }
  return {
    p,
    res: lastRes,
    approved,
    onTime: false,
    stall: "drain iteration cap reached without a terminal state",
    position: "stalled",
  };
}

// ---------------------------------------------------------------------------
// Per-entry evaluation.
// ---------------------------------------------------------------------------

/**
 * fixes/215: corpus delivery-kind → Project.kind. The corpus frontmatter
 * `kind` is a string contract (webapp/tool/game/cli-tool/library/service/"").
 * Project.kind is the 3-way "app"|"tool"|"game" (types.ts E-15). Declared
 * non-library kinds MUST become a Project.kind so codegen's tree trigger
 * (singleModuleLibraryKind) does not silently collapse them to the ≤8
 * single-module path. "library"/"service"/"" stay absent — the honest
 * single-module library path. Never invents a kind the corpus didn't declare.
 */
function deliveryKindOf(corpusKind) {
  switch (corpusKind) {
    case "webapp":
    case "app":
      return "app";
    case "game":
      return "game";
    case "tool":
    case "cli-tool":
      return "tool";
    default:
      return undefined; // library / service / "" → kind absent (library path)
  }
}

/** fixes/154 (F1) — parse one p6.synthesis.attempt journal detail ("chunk
 *  N/M · attempt N · <ms>ms · ok|refused|timeout[ · refusal: …]") and answer
 *  "did this model call come back ok?". The outcome token is the one
 *  immediately after the <ms>ms budget token — a refusal body appended after
 *  " · refusal: " can never be mistaken for it. */
function attemptLogOutcomeIsOk(detail) {
  if (typeof detail !== "string") return false;
  const m = detail.match(/·\s*\d+\s*ms\s*·\s*(ok|refused|timeout)(?:\s*·|$)/);
  return Boolean(m && m[1] === "ok");
}

/** ONE trial of the full pipeline: fresh project → drain → emit → tree-run →
 *  score. W5-L5 T-107.5: the emit dir is per-trial, and every grading input
 *  (identifiers, capabilities, acceptance assertions, pass threshold) comes
 *  from the RUN-SIDE `grader` passed in — never from the corpus frontmatter. */
async function runTrial(entry, mode, grader, { trial, emitDir, graderPath }) {
  const { slug } = entry;
  // fixes/215: corpus `kind` is the delivery contract ("webapp"/"tool"/"game"/
  // "cli-tool"/"library"/"service"). Map it onto Project.kind ("app"|"tool"|
  // "game") so keyed synthesis routes to the chunked multi-file tree for every
  // declared non-library surface — a dropped kind was the single-module leak
  // (webapp briefs shipped "tree 1 file(s)" + leftover TODO(E-15) job stubs).
  const kind = deliveryKindOf(entry.kind);
  const project0 = createProject({ brief: entry.brief, name: entry.name, ...(kind ? { kind } : {}) });

  // 1) DRAIN. Keyless = the full keyless floor regression (unchanged).
  //    Keyed = SINGLE-SYNTHESIS (fixes/147 E3): drain keyless/floor to the
  //    P6 gate (approve P4/P5, stop with phase 6 ready), then driveP6Journey
  //    runs THE one keyed synthesis; after the journey verdict the drain
  //    resumes from P7 keyless to a terminal state. Emit + treeRun happen
  //    ONCE at the end, on the final drained project (the journey's internal
  //    per-cycle tree-runs stay inside driveP6Journey's temp dir).
  let drain;
  let journey = null;
  if (mode === "keyed") {
    const pre = await drainPipeline(project0, { keyed: false, p6Gate: true });
    if (pre.position === "p6-gate") {
      // THE single keyed synthesis — the verdict that scores M3/M8 is taken
      // from THIS journey, never from a drain-side live P6 (divergence #4).
      journey = await driveP6Journey(pre.p, { budget: JOURNEY_BUDGET });
      const afterJourney = journey && journey.project ? journey.project : pre.p;
      drain = await drainPipeline(afterJourney, { keyed: false });
      drain.approved = [...pre.approved, ...drain.approved];
      if (!drain.stall && drain.position === "terminal" && drain.res && drain.res.outcome !== "complete") {
        drain.onTime = false;
        drain.stall = `post-journey drain ended ${drain.res.outcome} (not complete) after the P6 journey verdict`;
      }
    } else {
      // The floor drain could not reach the P6 gate (stall/terminal) — the
      // journey never ran; the honest stall evidence stands (M9=0).
      drain = pre;
    }
  } else {
    drain = await drainPipeline(project0, { keyed: false });
    journey = await driveP6Journey(drain.p, { budget: JOURNEY_BUDGET });
    if (journey && journey.project) drain = { ...drain, p: journey.project };
  }
  const finalProject = drain.p;

  const journeyEv = journey
    ? {
        outcome: journey.outcome,
        cycles: typeof journey.cycles === "number" ? journey.cycles : 0,
        budget: typeof journey.budget === "number" ? journey.budget : JOURNEY_BUDGET,
        refusal: typeof journey.refusal === "string" && journey.refusal ? journey.refusal : null,
      }
    : null;

  // 2) Emit to research/eval-out/<slug>/ (handover evidence for M6) — ONCE,
  //    at the end, on the final drained project. 216 (T-07 / F-07):
  //    `redTree:"banner"` — an uncleared red tree-run trail must not abort the
  //    benchmark, but it must NOT emit silently either: the emitted README.md
  //    is stamped with the unmissable red-tree banner and the honest
  //    `redTreeBanner` metric rides handover evidence below.
  const emitResult = await emitProject(finalProject, emitDir, { redTree: "banner" });
  let handoverEv = null;
  let treeEv = null;
  let runOutcome = null;
  if (emitResult && emitResult.ok === true) {
    const files = Array.isArray(emitResult.files) ? emitResult.files : [];
    const deployMd = files.some((f) => basename(f) === "DEPLOY.md");
    const oracleSpecPath =
      files.find((f) => /(^|\/)tests\/oracle\.spec\.ts$/.test(f)) ||
      files.find((f) => /(^|\/)tests\/.*\.(spec|test)\.ts$/.test(f)) ||
      null;
    let oracleSpecBytes = 0;
    if (oracleSpecPath) {
      try {
        oracleSpecBytes = statSync(join(emitDir, oracleSpecPath)).size;
      } catch {
        oracleSpecBytes = 0;
      }
    }
    handoverEv = {
      emitted: true,
      deployMd,
      oracleSpec: Boolean(oracleSpecPath),
      oracleSpecBytes,
      // 216 (T-07): true when the emitted README.md carries the red-tree
      // banner (the tree-run trail's last verdict was red and uncleared) —
      // the eval completes AND records the honest red verdict.
      redTreeBanner: emitResult.redTreeBanner === true,
    };
    // 3) Tree-run the emitted dir (M2 evidence) — ONCE, at the end.
    runOutcome = await treeRun(emitDir);
    treeEv = treeRunToEvidence(runOutcome);
  } else {
    handoverEv = {
      emitted: false,
      deployMd: false,
      oracleSpec: false,
      oracleSpecBytes: 0,
      emitError: emitResult && typeof emitResult.error === "string" ? emitResult.error : "emitProject failed",
    };
  }

  // 3b) RUN-SIDE ACCEPTANCE (W5-L5 / T-107.5): the grader's declared
  //     expectedFiles / expectedContent are checked against the emitted tree
  //     from OUTSIDE it, and the tree is scanned for grader leaks — the
  //     emitted project must neither contain nor reference its grader. Both
  //     land in the run evidence; a leak is printed LOUDLY, never swallowed.
  const acceptance = checkAcceptance(
    grader,
    emitDir,
    emitResult && Array.isArray(emitResult.files) ? emitResult.files : [],
  );
  const graderLeak = graderLeakScan(emitDir, grader);
  if (graderLeak.leaked) {
    console.log("");
    console.log(`!!!!! GRADER LEAK — emitted tree of ${slug} (trial ${trial}) carries run-side grader content:`);
    for (const h of graderLeak.hits.slice(0, 10)) console.log(`      ${h.marker} in ${h.file}`);
    console.log(`      grader file: ${graderPath}`);
    console.log("");
  }

  // 4) Score with the pure rubric.
  const logs = Array.isArray(finalProject.logs) ? finalProject.logs : [];
  const refusedSignal =
    logs.some((l) => l && l.event === "p6.synthesis.refused") || journeyEv?.outcome === "failed";
  const refusedCode =
    (logs.find((l) => l && l.event === "p6.synthesis.refused" && typeof l.detail === "string") || {}).detail ||
    null;
  // fixes/154 (F1) — synthesisSucceeded: did ANY P6 synthesis-model call log
  // an ok attempt (P1's p6.synthesis.attempt journal, detail "chunk N/M ·
  // attempt N · <ms>ms · ok|refused|timeout")? Keyed runs: true when ≥1 ok
  // attempt exists; false when none (every call refused/timed out, or the
  // journey never reached a model call) → scoreMaker's floor gate forces
  // M1-M4 = 0, because all green tree/run/mint evidence is then the
  // deterministic floor, never LLM-produced software. Keyless runs leave it
  // undefined → legacy scoring, byte-identical (keyless makes no model
  // calls, so the discriminator would be a vacuous false there).
  const synthesisSucceeded =
    mode === "keyed"
      ? logs.some((l) => l && l.event === "p6.synthesis.attempt" && attemptLogOutcomeIsOk(l.detail))
      : undefined;
  const sealedFlag = drain.res ? drain.res.sealedWithFailures === true : false;
  const stopCode = refusedSignal
    ? typeof refusedCode === "string" && /RT_E/.test(refusedCode)
      ? refusedCode.match(/RT_E[A-Z_0-9]*/)?.[0] ?? "RT_EVAL_REFUSED"
      : "RT_EVAL_REFUSED"
    : drain.stall
      ? "RT_EVAL_STALL"
      : null;
  const card = scoreMaker({
    project: finalProject,
    // W5-L5 T-107.5: grading inputs come from the RUN-SIDE grader
    // (scoringCorpusFor) — the corpus frontmatter copies are documentation.
    corpus: scoringCorpusFor(entry, grader),
    treeRun: treeEv,
    journey: journeyEv,
    run: { sealedWithFailures: sealedFlag || logs.some((l) => l && l.event === "run.complete.with.failed.gates") },
    handover: handoverEv,
    budget: journeyEv ? { used: journeyEv.cycles, budget: journeyEv.budget } : null,
    stop: {
      onTime: drain.onTime,
      refused: refusedSignal,
      loud: refusedSignal ? Boolean(stopCode) : Boolean(drain.stall),
      code: stopCode,
    },
    prior: priorFor(slug),
    synthesisSucceeded,
  });

  // 5) M1 capability-coverage report (fixes/147 E3 — the divergence-1 signal).
  //    maker-score stays pure: the coverage MAP is computed here in the driver
  //    (which holds corpus + tree) via maker-score's exported pure probes, so
  //    the report can never drift from the M1 verdict. Every entry persists
  //    its coverage; when a KEYED journey CONVERGED but M1=0, the missing
  //    capability list is printed LOUDLY (a converged run that shipped no
  //    identifier for a demanded capability = divergence #1 in the flesh).
  const coverage = capabilityCoverage(finalProject, grader.requiredCapabilities);
  // fixes/154 (F1): when synthesisSucceeded === false the floor gate forced
  // M1=0 regardless of coverage — that zero is the "no LLM software exists"
  // statement, NOT a divergence-1 mapping gap, so the alarm below must not
  // misattribute it. The alarm fires only when LLM content may exist
  // (true/undefined) and a converged keyed journey still left a capability
  // without a single identifier.
  const loudM1Zero =
    mode === "keyed" &&
    synthesisSucceeded !== false &&
    journeyEv?.outcome === "converged" &&
    card.criteria.M1.score === 0;
  if (loudM1Zero) {
    const coveredLines = Object.entries(coverage.covered).map(
      ([cap, files]) => `    covered  ${cap} -> ${files.join(", ")}`,
    );
    console.log("");
    console.log("!!!!! M1=0 ON A CONVERGED KEYED JOURNEY (divergence-1 capability coverage) —", slug);
    console.log(`      expectedCapabilities=${grader.requiredCapabilities.length} · tree files=${treeFilesOf(finalProject).length}`);
    for (const line of coveredLines) console.log(line);
    if (coverage.missing.length > 0) {
      console.log(`      MISSING (no identifier in any tree file):`);
      for (const cap of coverage.missing) console.log(`        - ${cap}`);
    } else {
      console.log("      (no expectedCapabilities demanded — M1=0 comes from another branch)");
    }
    console.log("");
  }

  // W5-L5 T-107.5: grader provenance + run-side acceptance evidence ride the
  // row (additive keys). `graderHash` pins the effective bar that graded this
  // trial; `graderLeak` proves the emitted tree never carried the grader.
  const graderHash = String(fnv1a(JSON.stringify(grader)));
  const entryRow = {
    slug,
    name: entry.name,
    domain: entry.domain || null,
    domainMatch: domainMatch(entry, finalProject),
    kind: entry.kind || null,
    status: drain.res ? drain.res.outcome : "stalled",
    mode,
    criteria: card.criteria,
    total: card.total,
    mean: Number(card.mean.toFixed(4)),
    baseline: entry.baseline,
    coverage,
    // --- W5-L5 additive keys ---
    trial,
    emitDir,
    grader: {
      path: graderPath,
      hash: graderHash,
      // The bar TEXT stays in the run-side grader file only — the evidence
      // records its hash + length, never a second copy.
      barChars: grader.acceptanceBar.length,
      requiredIdentifiers: grader.requiredIdentifiers.length,
      requiredCapabilities: grader.requiredCapabilities.length,
    },
    acceptance: { ...acceptance, pass: false }, // `pass` filled per-trial by evaluateEntry
    graderLeak: { scanned: graderLeak.scanned, leaked: graderLeak.leaked, hits: graderLeak.hits },
    // --- end W5-L5 additive keys ---
    notes: {
      approvedGates: drain.approved,
      treeRunOk: treeEv ? treeEv.ok : false,
      journey: journeyEv ? journeyEv.outcome : null,
      stall: drain.stall,
      emitError: handoverEv && !handoverEv.emitted ? handoverEv.emitError ?? null : null,
      p6Refused: refusedSignal,
      // fixes/154 (F1): the floor-gate discriminator this card was scored
      // under — true = ≥1 ok synthesis attempt, false = none (floor card),
      // absent = keyless run (legacy scoring).
      synthesisSucceeded,
    },
  };
  return { entryRow, card, acceptance };
}

/** W5-L5 T-107.5 — the run-side pass predicate for one trial: the rubric met
 *  the grader's threshold AND every declared run-side file/content assertion
 *  held. A crash/missing mean is a FAIL, never a default pass. */
export function passesAcceptance(row, acceptance, grader) {
  if (!row || typeof row.mean !== "number" || !Number.isFinite(row.mean)) return false;
  if (row.mean < grader.passWhen.meanAtLeast) return false;
  if (grader.passWhen.requireExpectedFiles && acceptance.filesOk !== true) return false;
  if (grader.passWhen.requireExpectedContent && acceptance.contentOk !== true) return false;
  return true;
}

/** W5-L5 T-107.5 — run TRIALS fresh trials of one case (fresh project + fresh
 *  emit workspace per trial) and summarize honestly. The returned row keeps
 *  trial 1's rubric card (`rowSource: "trial-1"` — documented, never an
 *  average) and carries the `trials` block: pass@1 / pass@k / pass^k /
 *  flakiness over every trial's own run-side pass verdict. */
async function evaluateEntry(entry, mode, grader, graderPath) {
  const trialRows = [];
  const acceptances = [];
  let firstCard = null;
  for (let trial = 1; trial <= TRIALS; trial += 1) {
    const emitDir = trialEmitDir(OUT_DIR, entry.slug, trial, TRIALS);
    const t0 = Date.now();
    const r = await runTrial(entry, mode, grader, { trial, emitDir, graderPath });
    const durationSec = Number(((Date.now() - t0) / 1000).toFixed(1));
    const pass = passesAcceptance(r.entryRow, r.acceptance, grader);
    r.entryRow.acceptance.pass = pass;
    r.entryRow.durationSec = durationSec;
    trialRows.push(r.entryRow);
    acceptances.push({ ...r.acceptance, pass });
    if (trial === 1) firstCard = r.card;
    const shortfalls = [
      ...r.acceptance.missingFiles.map((f) => `missing ${f}`),
      ...r.acceptance.failedContent.slice(0, 2),
    ];
    console.log(
      `     trial ${trial}/${TRIALS}: ${r.entryRow.status} · ${r.entryRow.total}/9 (mean ${r.entryRow.mean.toFixed(2)}) · pass=${pass ? "yes" : "no"}` +
        (shortfalls.length > 0 ? ` · acceptance: ${shortfalls.slice(0, 3).join("; ")}` : "") +
        ` · ${durationSec}s`,
    );
  }
  const outcomes = trialRows.map((row) => row.acceptance.pass === true);
  const trialsBlock = trialsSummary(outcomes, { k: K });
  const row = {
    ...trialRows[0],
    rowSource: "trial-1",
    trials: trialsBlock,
    acceptance: acceptances[0],
    graderLeak: {
      scanned: trialRows.reduce((a, r) => a + (r.graderLeak.scanned || 0), 0),
      leaked: trialRows.some((r) => r.graderLeak.leaked === true),
      hits: trialRows.flatMap((r) => (r.graderLeak.hits || []).map((h) => ({ ...h, trial: r.trial }))),
    },
    perTrial: trialRows.map((r, i) => ({
      trial: r.trial,
      status: r.status,
      total: r.total,
      mean: r.mean,
      pass: r.acceptance.pass === true,
      emitDir: r.emitDir,
      durationSec: r.durationSec,
      graderLeak: r.graderLeak.leaked === true,
      acceptance: acceptances[i],
    })),
  };
  if (trialsBlock.flaky === true) {
    console.log("");
    console.log(`!!!!! FLAKY CASE — ${entry.slug}: ${trialsBlock.passes}/${trialsBlock.trials} trials passed`);
    console.log(`      pass@1=${trialsBlock.passAt1} · pass@${trialsBlock.kEffective}=${trialsBlock.passAtK} · passAllTrials=${trialsBlock.passAllTrials}`);
    console.log("      a case that flips between trials is FLAKY — never averaged into a pass");
    console.log("");
  }
  return { entryRow: row, card: firstCard, trialRows, trialsBlock };
}

// ---------------------------------------------------------------------------
// Table + persistence.
// ---------------------------------------------------------------------------

function pad(s, n) {
  const str = String(s);
  return str.length >= n ? str.slice(0, n) : str + " ".repeat(n - str.length);
}

function printTable(rows) {
  const header = ["slug", "dm", "M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "total", "baseline", "n", "pass@k"];
  const widths = {
    slug: Math.max(8, ...rows.map((r) => String(r.entryRow.slug).length + 2)),
  };
  const line = (cells) =>
    cells
      .map((c, i) => (i === 0 ? pad(c, widths.slug) : pad(c, i === 11 ? 6 : i === 12 ? 12 : i === 13 ? 2 : i === 14 ? 7 : 3)))
      .join(" ");
  const headerLine = line(header);
  console.log(headerLine);
  console.log("-".repeat(headerLine.length));
  for (const { entryRow } of rows) {
    const dm = entryRow.domainMatch === null ? "·" : String(entryRow.domainMatch);
    const tb = entryRow.trials;
    const cells = [
      entryRow.slug,
      dm,
      ...["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9"].map((m) => String(entryRow.criteria[m].score)),
      entryRow.mean.toFixed(2),
      String(entryRow.baseline).slice(0, 12),
      tb ? String(tb.trials) : "·",
      tb && typeof tb.passAtK === "number" ? tb.passAtK.toFixed(2) : "·",
    ];
    console.log(line(cells));
  }
}

/** The effective k actually used by the recorded trials blocks (min(k, trials)). */
function trialsKEffective(rows) {
  const hit = rows.find((r) => r.entryRow.trials && typeof r.entryRow.trials.kEffective === "number");
  return hit ? hit.entryRow.trials.kEffective : null;
}

/** W5-L5 T-107.5 — trials/pass@k summary lines (honest: flaky cases named,
 *  unmeasurable flakiness at 1 trial stated, grader leaks surfaced). */
function printTrialsSummary(rows) {
  if (rows.length === 0) return;
  const flaky = rows.filter((r) => r.entryRow.trials && r.entryRow.trials.flaky === true).map((r) => r.entryRow.slug);
  const leaked = rows.filter((r) => r.entryRow.graderLeak && r.entryRow.graderLeak.leaked === true).map((r) => r.entryRow.slug);
  const withTrials = rows.filter((r) => r.entryRow.trials && typeof r.entryRow.trials.passAtK === "number");
  const meanPassAt1 = withTrials.length
    ? withTrials.reduce((a, r) => a + (r.entryRow.trials.passAt1 ?? 0), 0) / withTrials.length
    : 0;
  console.log(
    `trials: ${TRIALS} per case · k=${K} (effective ≤ trials) · pass@${trialsKEffective(rows) ?? K}: ` +
      withTrials.map((r) => `${r.entryRow.slug}=${r.entryRow.trials.passAtK.toFixed(2)}`).join(" ") +
      ` · pass^n(all trials): ` +
      withTrials.map((r) => `${r.entryRow.slug}=${r.entryRow.trials.passAllTrials.toFixed(2)}`).join(" "),
  );
  console.log(`trials: pass@1 mean=${meanPassAt1.toFixed(3)} · flaky=${flaky.length > 0 ? flaky.join(",") : "none"} · grader leaks=${leaked.length > 0 ? leaked.join(",") : "none"}`);
  if (TRIALS < 2) {
    console.log("trials note: flakiness is UNMEASURABLE at 1 trial (pass@1 only) — use --trials=N ≥ 2 for pass@k + flakiness");
  }
}

/** W5-L5 T-107.5 — additive JSON summary block. The legacy keys
 *  (`entries`, `meanTotal`) keep their meaning; everything here is new. */
export function buildSummary(rows, skips = [], trials = TRIALS) {
  const cases = rows.length;
  const flaky = rows.filter((r) => r.entryRow.trials && r.entryRow.trials.flaky === true).map((r) => r.entryRow.slug);
  const leaked = rows.filter((r) => r.entryRow.graderLeak && r.entryRow.graderLeak.leaked === true).map((r) => r.entryRow.slug);
  const passed = rows.filter((r) => r.entryRow.trials && r.entryRow.trials.passes === r.entryRow.trials.trials).map((r) => r.entryRow.slug);
  const withTrials = rows.filter((r) => r.entryRow.trials && typeof r.entryRow.trials.passAt1 === "number");
  const meanPassAt1 = withTrials.length ? round4(withTrials.reduce((a, r) => a + r.entryRow.trials.passAt1, 0) / withTrials.length) : 0;
  return {
    trials,
    cases,
    passAtK: { k: trials, cases, passed: passed.length, passedSlugs: passed, meanPassAt1 },
    flakyCases: flaky,
    graderLeaks: leaked,
    skipped: skips.length,
    skips,
  };
}

function persist(rows, mode, skips = []) {
  mkdirSync(OUT_DIR, { recursive: true });
  const results = {
    generatedAt: new Date().toISOString(),
    mode,
    corpusDir: CORPUS_DIR,
    // W5-L5 additive: where the run-side acceptance bars came from.
    graderDir: GRADER_DIR,
    entries: rows.map((r) => r.entryRow),
    summary: {
      entries: rows.length,
      meanTotal: rows.length ? rows.reduce((a, r) => a + r.entryRow.mean, 0) / rows.length : 0,
      ...buildSummary(rows, skips),
    },
  };
  writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2), "utf8");

  const history = readJson(HISTORY_PATH, []);
  const at = new Date().toISOString();
  for (const row of rows) {
    const trialRows = Array.isArray(row.trialRows) && row.trialRows.length > 0 ? row.trialRows : [row.entryRow];
    for (const t of trialRows) {
      history.push({
        at,
        mode,
        slug: t.slug,
        // W5-L5 additive: which trial of how many produced this row.
        trial: typeof t.trial === "number" ? t.trial : 1,
        trials: TRIALS,
        pass: t.acceptance ? t.acceptance.pass === true : null,
        m1: t.criteria.M1.score,
        m2: t.criteria.M2.score,
        m3: t.criteria.M3.score,
        m4: t.criteria.M4.score,
        m5: t.criteria.M5.score,
        m6: t.criteria.M6.score,
        m7: t.criteria.M7.score,
        m8: t.criteria.M8.score,
        m9: t.criteria.M9.score,
        total: t.total,
        mean: t.mean,
      });
    }
  }
  writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2), "utf8");
  return results;
}

// ---------------------------------------------------------------------------
// Main — results are data: exit 0 always.
// ---------------------------------------------------------------------------

async function main() {
  const mode = KEYED_OK ? "keyed" : "keyless";
  console.log(`rapidtool eval · mode=${mode}${KEYED && !KEYED_OK ? " (--keyed requested but DEEPSEEK_API_KEY unset — falling back to keyless)" : ""} · corpus=${CORPUS_DIR}`);
  console.log(
    `graders: run-side acceptance bars under ${GRADER_DIR} (read by this driver only — never emitted into a project tree) · trials=${TRIALS}` +
      (TRIALS !== TRIALS_REQUESTED ? ` (--trials=${TRIALS_REQUESTED} invalid or over max ${MAX_TRIALS} → ${TRIALS})` : ""),
  );
  for (const notice of keylessSkipNotices({ keyedRequested: KEYED, hasKey: Boolean(process.env.DEEPSEEK_API_KEY) })) {
    console.log(`note: ${notice}`);
  }
  if (TRIALS < 2) {
    console.log("note: trials=1 — the legacy single-run contract; pass@1 is recorded and flakiness is UNMEASURABLE (use --trials=N ≥ 2)");
  } else if (mode === "keyed") {
    console.log(`note: keyed × trials=${TRIALS} multiplies live model cost — the keyed cost guard below still bounds the target count`);
  }

  const found = listCorpusEntries();
  const entries = found.filter((f) => f.entry !== null).map((f) => f.entry);
  const skipped = found
    .filter((f) => f.entry === null)
    .map((s) => ({ slug: null, kind: "unreadable-corpus-entry", reason: s.error }));
  for (const s of skipped) console.log(`note: skipping unreadable corpus entry: ${s.reason}`);

  if (entries.length === 0) {
    console.log("note: no corpus entries present at research/eval-corpus — D3 parallel corpus writes may not have landed yet; nothing to evaluate. Results are data, exit 0.");
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(
      RESULTS_PATH,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          mode,
          graderDir: GRADER_DIR,
          entries: [],
          summary: { entries: 0, meanTotal: 0, ...buildSummary([], skipped) },
        },
        null,
        2,
      ),
      "utf8",
    );
    process.exit(0);
  }

  // W5-L5 T-107.5 — the RUN-SIDE grader decides what is gradeable. A case with
  // no valid grader file is SKIPPED with a reason (recorded in the summary),
  // never scored against an undeclared bar.
  const plan = planTargets(entries, (slug) => loadGrader(slug));
  const skips = [...skipped, ...plan.skips];
  for (const s of plan.skips) console.log(`skip ${s.slug}: ${s.reason}`);
  const targets = plan.targets;

  // Keyed default: ONE entry (cost guard). `--all` or `--limit=N` lifts it.
  const cap = EVAL_ALL ? targets.length : Number.isFinite(EVAL_LIMIT) && EVAL_LIMIT > 0 ? EVAL_LIMIT : mode === "keyed" ? 1 : targets.length;
  const selected = targets.slice(0, cap);
  if (mode === "keyed" && selected.length < targets.length) {
    console.log(`note: keyed leg bounded to ${selected.length} corpus entry (${selected[0].entry.slug}); pass --all or --limit=N for more; budget per P6 journey = ${JOURNEY_BUDGET} cycle(s)`);
  }

  const rows = [];
  if (selected.length === 0) {
    console.log("note: nothing gradeable — every corpus entry was skipped above (results recorded with the skip reasons, exit 0)");
  }
  for (const { entry, grader, graderPath } of selected) {
    try {
      const t0 = Date.now();
      const { entryRow, card, trialRows } = await evaluateEntry(entry, mode, grader, graderPath);
      rows.push({ entryRow, card, trialRows });
      const tb = entryRow.trials;
      console.log(
        `ok   ${entry.slug}: ${entryRow.status} · ${entryRow.total}/9 (mean ${entryRow.mean.toFixed(2)}) · ${tb.trials} trial(s) · pass@${tb.kEffective}=${tb.passAtK}${tb.flaky ? " · FLAKY" : ""} · ${((Date.now() - t0) / 1000).toFixed(1)}s`,
      );
    } catch (e) {
      // An entry that blows up is recorded as data, never a process failure.
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`fail ${entry.slug}: ${msg.slice(0, 300)}`);
      rows.push({
        entryRow: {
          slug: entry.slug,
          name: entry.name,
          domain: entry.domain || null,
          domainMatch: null,
          kind: entry.kind || null,
          status: "error",
          mode,
          criteria: Object.fromEntries(["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9"].map((m) => [m, { score: 0, evidence: msg.slice(0, 200) }])),
          total: 0,
          mean: 0,
          baseline: entry.baseline,
          coverage: { covered: {}, missing: [...grader.requiredCapabilities] },
          // W5-L5: a crash is a FAILED trial, never a hidden one.
          trials: trialsSummary(Array.from({ length: TRIALS }, () => false), { k: TRIALS }),
          grader: { path: graderPath, hash: String(fnv1a(JSON.stringify(grader))) },
          perTrial: [],
          notes: { error: msg.slice(0, 300), trialsCrashed: true },
        },
        card: null,
        trialRows: [],
      });
    }
  }

  console.log("");
  printTable(rows);
  printTrialsSummary(rows);
  const results = persist(rows, mode, skips);
  console.log(`\nwrote ${RESULTS_PATH} · ${results.entries.length} entr${results.entries.length === 1 ? "y" : "ies"} · history appended to ${HISTORY_PATH}`);
  if (skips.length > 0) console.log(`skips recorded: ${skips.length} — ${skips.map((s) => s.slug ?? "corpus").join(", ")}`);
  console.log("exit 0 — results are data, not failures");
  process.exit(0);
}

/** Run the driver only when executed directly (`npm run eval`) — importing this
 *  module (scripts/run-eval.test.mjs) must never start an eval run. W5-L5. */
const isMainModule = (() => {
  try {
    return Boolean(process.argv[1]) && resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
  } catch {
    return false;
  }
})();

if (isMainModule) {
  main().catch((e) => {
    // The driver itself failing is still data-shaped, but it IS a real crash:
    // print + exit 0 per the results-are-data contract, after recording it.
    try {
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(RESULTS_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), mode: KEYED_OK ? "keyed" : "keyless", entries: [], error: e instanceof Error ? e.message : String(e) }, null, 2), "utf8");
    } catch {
      /* nowhere to write */
    }
    console.error(`eval driver crashed: ${e instanceof Error ? e.stack : String(e)}`);
    process.exit(0);
  });
}
