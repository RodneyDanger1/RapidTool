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
 * Results are DATA, not failures: the script exits 0 always (missing corpus
 * dir, unparseable entries, red scores — all printed and recorded, never
 * thrown as process failures). Keyless = the honest regression leg.
 *
 * Run: npm run eval            (keyless)
 *      npm run eval -- --keyed (one bounded keyed entry when the key is set)
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

const JOURNEY_BUDGET = 3;
const KEYED = process.argv.includes("--keyed");
const KEYED_OK = KEYED && Boolean(process.env.DEEPSEEK_API_KEY);
const EVAL_ALL = process.argv.includes("--all");
const LIMIT_ARG = process.argv.find((a) => a.startsWith("--limit="));
const EVAL_LIMIT = LIMIT_ARG ? Number(LIMIT_ARG.slice("--limit=".length)) : NaN;

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

async function evaluateEntry(entry, mode) {
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
  const emitDir = join(OUT_DIR, slug);
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
    corpus: {
      kind: entry.kind,
      brief: entry.brief,
      expectedNouns: entry.expectedNouns,
      expectedCapabilities: entry.expectedCapabilities,
    },
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
  const coverage = capabilityCoverage(finalProject, entry.expectedCapabilities);
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
    console.log(`      expectedCapabilities=${entry.expectedCapabilities.length} · tree files=${treeFilesOf(finalProject).length}`);
    for (const line of coveredLines) console.log(line);
    if (coverage.missing.length > 0) {
      console.log(`      MISSING (no identifier in any tree file):`);
      for (const cap of coverage.missing) console.log(`        - ${cap}`);
    } else {
      console.log("      (no expectedCapabilities demanded — M1=0 comes from another branch)");
    }
    console.log("");
  }

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
  return { entryRow, card };
}

// ---------------------------------------------------------------------------
// Table + persistence.
// ---------------------------------------------------------------------------

function pad(s, n) {
  const str = String(s);
  return str.length >= n ? str.slice(0, n) : str + " ".repeat(n - str.length);
}

function printTable(rows) {
  const header = ["slug", "dm", "M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "total", "baseline"];
  const widths = {
    slug: Math.max(8, ...rows.map((r) => String(r.entryRow.slug).length + 2)),
  };
  const line = (cells) => cells.map((c, i) => (i === 0 ? pad(c, widths.slug) : pad(c, i === 11 ? 6 : i === 12 ? 12 : 3))).join(" ");
  console.log(line(header));
  console.log("-".repeat(widths.slug + 3 * 9 + 7 + 6 + 12 + 10));
  for (const { entryRow } of rows) {
    const dm = entryRow.domainMatch === null ? "·" : String(entryRow.domainMatch);
    const cells = [
      entryRow.slug,
      dm,
      ...["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9"].map((m) => String(entryRow.criteria[m].score)),
      entryRow.mean.toFixed(2),
      String(entryRow.baseline).slice(0, 12),
    ];
    console.log(line(cells));
  }
}

function persist(rows, mode) {
  mkdirSync(OUT_DIR, { recursive: true });
  const results = {
    generatedAt: new Date().toISOString(),
    mode,
    corpusDir: CORPUS_DIR,
    entries: rows.map((r) => r.entryRow),
    summary: {
      entries: rows.length,
      meanTotal: rows.length ? rows.reduce((a, r) => a + r.entryRow.mean, 0) / rows.length : 0,
    },
  };
  writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2), "utf8");

  const history = readJson(HISTORY_PATH, []);
  const at = new Date().toISOString();
  for (const { entryRow } of rows) {
    history.push({
      at,
      mode,
      slug: entryRow.slug,
      m1: entryRow.criteria.M1.score,
      m2: entryRow.criteria.M2.score,
      m3: entryRow.criteria.M3.score,
      m4: entryRow.criteria.M4.score,
      m5: entryRow.criteria.M5.score,
      m6: entryRow.criteria.M6.score,
      m7: entryRow.criteria.M7.score,
      m8: entryRow.criteria.M8.score,
      m9: entryRow.criteria.M9.score,
      total: entryRow.total,
      mean: entryRow.mean,
    });
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

  const found = listCorpusEntries();
  const entries = found.filter((f) => f.entry !== null).map((f) => f.entry);
  const skipped = found.filter((f) => f.entry === null);
  for (const s of skipped) console.log(`note: skipping unreadable corpus entry: ${s.error}`);

  if (entries.length === 0) {
    console.log("note: no corpus entries present at research/eval-corpus — D3 parallel corpus writes may not have landed yet; nothing to evaluate. Results are data, exit 0.");
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(RESULTS_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), mode, entries: [], summary: { entries: 0, meanTotal: 0 } }, null, 2), "utf8");
    process.exit(0);
  }

  // Keyed default: ONE entry (cost guard). `--all` or `--limit=N` lifts it.
  const cap = EVAL_ALL ? entries.length : Number.isFinite(EVAL_LIMIT) && EVAL_LIMIT > 0 ? EVAL_LIMIT : mode === "keyed" ? 1 : entries.length;
  const targets = entries.slice(0, cap);
  if (mode === "keyed" && targets.length < entries.length) {
    console.log(`note: keyed leg bounded to ${targets.length} corpus entry (${targets[0].slug}); pass --all or --limit=N for more; budget per P6 journey = ${JOURNEY_BUDGET} cycle(s)`);
  }

  const rows = [];
  for (const entry of targets) {
    try {
      const t0 = Date.now();
      const { entryRow, card } = await evaluateEntry(entry, mode);
      rows.push({ entryRow, card });
      console.log(`ok   ${entry.slug}: ${entryRow.status} · ${entryRow.total}/9 (mean ${entryRow.mean.toFixed(2)}) · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
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
          coverage: { covered: {}, missing: [...entry.expectedCapabilities] },
          notes: { error: msg.slice(0, 300) },
        },
        card: null,
      });
    }
  }

  console.log("");
  printTable(rows);
  const results = persist(rows, mode);
  console.log(`\nwrote ${RESULTS_PATH} · ${results.entries.length} entr${results.entries.length === 1 ? "y" : "ies"} · history appended to ${HISTORY_PATH}`);
  console.log("exit 0 — results are data, not failures");
  process.exit(0);
}

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
