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
 * W16-L1 (fixes/244) — OV-35 Step-0 preflight, three additive pieces:
 *   (a) OV-27 reachability probe (`probeP6Reachability`) — proves the CLI keyed
 *       path can reach a model through the P6 SEPARATE-SPECIFIER imports
 *       (engine.ts:2851-2885), keyless with a dummy key: reports `configured`
 *       + wire-reach honestly and states what only a real key can prove;
 *   (b) failure-class triage (`classifyRunOutcome`/`classifyDrainEnding`) — a
 *       coded class for EVERY RunOutcome value and drain ending; no ending may
 *       surface as a silent `stalled`;
 *   (c) kill-safety run marker (`writeRunStartMarker`/`finishRunMarker`/
 *       `runWithMarker`) — WRITTEN BEFORE the first corpus entry of a keyed
 *       run and finalized only after results.json AND history.json are written
 *       (WB-6), so a killed run leaves `finishedAt:null` and cannot be mistaken
 *       for a completed one. Keyless legs write nothing new (byte-identical).
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
 * W19-L4 (fixes/252) — OV-7 corpus expansion + grader-FREEZE audit, additive:
 *   (a) corpus spread — `permit-inspection-tracker` joins `field-ops-suite` as a
 *       second `construction` fixture, so ≥2 domains each carry ≥2 fixtures and
 *       the M7/learning prior is citable inside each (`corpusDomainIndex`; the
 *       pin lives in scripts/run-eval.test.mjs). Prior reads stay BY SLUG
 *       (`priorFor`): a slug's first run has no prior — honest, stated, never
 *       faked. `priorFor` takes an injectable history path for the test pin.
 *   (b) grader freeze — every grader file is fingerprint-raw-bytes at plan time
 *       (`graderFreezeFingerprint`) and re-verified before persist
 *       (`verifyGraderFreeze`); a grader that moved mid-run stamps
 *       `results.json.graderFreeze.ok=false` + a loud print, because a bar that
 *       changed while the run was in flight cannot grade that run. The driver
 *       still LOADS each grader exactly once (plan time) and every trial scores
 *       against that in-memory object.
 *   (c) brief leak scan — `briefLeakScan` closes the OTHER leak direction the
 *       playbook names (230 §OV-7: the emitted-tree scan misses grader text
 *       baked into the *brief*): the agent-facing surface (brief + name) is
 *       scanned for the grader's bar/file name and recorded per row.
 *
 * Results are DATA, not failures: the script exits 0 always (missing corpus
 * dir, unparseable entries, red scores — all printed and recorded, never
 * thrown as process failures). Keyless = the honest regression leg.
 *
 * Run: npm run eval            (keyless)
 *      npm run eval -- --keyed (one bounded keyed entry when the key is set)
 *      npm run eval -- --trials=3 [--all|--limit=N]   (trials + pass@k)
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync, rmSync, renameSync } from "node:fs";
import { join, dirname, basename, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  createProject,
  runUntilGate,
  approve,
  driveP6Journey,
  promoteEmittedTreeTested,
  emitProject,
} from "../src/lib/headless.ts";
import { treeRun } from "../src/lib/compile-check.server.ts";
import { scoreMaker, capabilityCoverage, treeFilesOf } from "../src/lib/maker-score.ts";
import { fnv1a } from "../src/lib/algorithms.ts";
// W23-L1 (fixes/262): the trial rows' usage/cost evidence consumes the
// T-107.6 ledger helpers directly — consume, never recompute. F1 (314) adds
// the session-budget READ (isBudgetExhausted) the iterate decision consults.
import { emptyLedger, recordSpend, totalTokens, estimateCostUsd, sessionTokenBudget, isBudgetExhausted } from "../src/lib/token-ledger.ts";
// F1 (314) — the iterate driver's config gate + PURE decision (src/lib/iterate.ts).
// The eval side RECORDS the per-trial decision (additive `iterate` row block);
// the live keyed firing is owner-gated and never engages in this leg.
import { readIterateConfig, decideIterate, ITERATE_THRESHOLD_ENV } from "../src/lib/iterate.ts";
// W43 · H5 (fixes/316_h5_oracle.md · T6.3): the behavioral oracle is ONE shared
// module now — `src/lib/entry-oracle.ts` (moved VERBATIM out of this driver).
// The product path (compile-check.server.ts `treeRun`) evaluates a tree's OWN
// declared contract (`entry-runs` rows in `.rapidtool/project.json`) with the
// same primitive; this driver delegates its eval-side evaluation to it, so
// there is exactly one truth for expectExit / expectStdout / expectStderr
// semantics and for the row-validation refusals.
import {
  checkEntryContract,
  manifestFind,
  manifestHas,
  normalizeEmittedFiles,
  runEntryOracle,
  validateExpectedBehavior,
} from "../src/lib/entry-oracle.ts";
// W43 · H5 (fixes/316_h5_oracle.md · T5.4): run-level eval telemetry — the
// driver stamps its OWN bounded rows (host "cli", scope "eval-run") so
// `diagnose` can audit an eval run; the rt-events catalogue owns the legal
// event names (guardrail checked at emit time).
import { isKnownRtEvent } from "../src/lib/rt-events.ts";
import { appendRtLine, makeCliRow, resolveLogDir } from "../src/lib/runtime-log.server.ts";

// W44 · A1 + parent completion (fixes/318_a1_oracle.md · T5.4): THE bounded
// run-level emitter — run start + run end + the top-catch crash row, ≤3 rows
// per run. The rt-events catalogue is the guardrail (an unknown name is
// refused, never invented); telemetry must NEVER alter the run or its scores:
// any failure here is swallowed.
const EVAL_RT_SESSION = `ev-${Date.now().toString(36)}`;
export function emitEvalRunRow(seed) {
  try {
    if (!seed || !isKnownRtEvent(seed.event)) return;
    const row = makeCliRow(seed, EVAL_RT_SESSION);
    appendRtLine(row, { logDir: resolveLogDir(null) });
  } catch {
    /* telemetry must never break the eval it observes */
  }
}

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

/** OV-7 corpus spread: domain → slugs for the parsed entries. Pure. The
 *  test pin reads the REAL corpus through this (`listCorpusEntries` is the
 *  same loader the driver uses — no second parser to drift). */
export function corpusDomainIndex(entries) {
  const byDomain = {};
  for (const e of entries) {
    const d = typeof e.domain === "string" && e.domain.trim() ? e.domain.trim() : "(unstated)";
    if (!byDomain[d]) byDomain[d] = [];
    byDomain[d].push(e.slug);
  }
  return byDomain;
}

/** Walk the corpus dir into `{ entry, error }` records (frontmatter-carrying
 *  `.md` files only; README-style documentation is skipped). Exported for the
 *  OV-7 corpus-spread pin, which reads the real corpus through this loader. */
export function listCorpusEntries() {
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
  // W40·N4 (§R7-f04): the DECLARED delivery kind this grader demands of the
  // emitted tree — asserted against the emitted README's "**Kind:** <kind>"
  // line by checkExpectedKind, so a keyword-table edit (or a dropped declared
  // kind) can never silently mis-kind a fixture. Absent = a v1 grader (no
  // kind assertion; v1 back-compat). Values = the scaffold taxonomy
  // (scaffold.ts projectKindOf): webapp | cli-tool | library | game | service.
  const EXPECTED_KINDS = new Set(["webapp", "cli-tool", "library", "game", "service"]);
  let expectedKind = null;
  if (doc.expectedKind !== undefined) {
    if (typeof doc.expectedKind !== "string" || !EXPECTED_KINDS.has(doc.expectedKind.trim())) {
      return {
        ok: false,
        error: `expectedKind must be one of ${[...EXPECTED_KINDS].join(" | ")} (got ${JSON.stringify(doc.expectedKind)})`,
      };
    }
    expectedKind = doc.expectedKind.trim();
  }
  // A3-f05/R11-f12 (W36 · N5 — landing the structure W30 §Graders spec'd;
  // fixes/299 U1 completes it; W44·A1: the row-shape validation DELEGATES to
  // the shared oracle's `validateExpectedBehavior` — no local copy): optional
  // per-kind expectedBehavior rows over the EMITTED TREE (not text presence).
  // A grader that cannot be trusted never grades (the refusal strings are the
  // grader-loading contract — byte-for-byte what the shared validator emits);
  // the rows are evaluated later by checkExpectedBehavior. Checks:
  //   file-exists           — `path` must exist in the emitted tree manifest
  //   package-target-exists — the emitted package.json's `bin`|`main`|`exports`
  //                           target(s) must resolve to emitted files
  //   entry-runs            — RUNTIME row, evaluated by a bounded, env-minimal
  //                           spawn of the emitted `entry` (fixes/299 U1):
  //                           pass = the declared exit/output pins hold within
  //                           budget; fail = timeout / exit mismatch / missing
  //                           pin text / missing entry. A UI kind declares
  //                           `uiShell: true` instead of an entry — that is a
  //                           structural skip (verified against the tree's
  //                           index.html, mirroring treeRun's resolveEntry),
  //                           never a silent pass. Rows that name neither an
  //                           `entry` nor `uiShell` are REJECTED: they could
  //                           only ever read `pending` (the pre-U1
  //                           never-failing shape this lane closed).
  const validatedBehavior = validateExpectedBehavior(doc.expectedBehavior);
  if (!validatedBehavior.ok) return { ok: false, error: validatedBehavior.error };
  const expectedBehavior = validatedBehavior.rows;
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
      // W40·N4 (§R7-f04): the declared delivery kind the emitted tree must
      // land (null = v1 grader — no assertion).
      expectedKind,
      // W36 · N5: the checked expectedBehavior rows ([] = legacy grader — the
      // verification label then reads "files+content only", exactly the
      // pre-expectedBehavior contract).
      expectedBehavior,
      passWhen: {
        meanAtLeast,
        requireExpectedFiles: pw.requireExpectedFiles !== false,
        requireExpectedContent: pw.requireExpectedContent !== false,
        // A declared bar is mandatory by default — same doctrine as files/content;
        // `false` is the explicit leniency opt-out (a declared row that FAILED
        // is never a pass unless the grader says so; a `pending` runtime row
        // never fails a tree — it is visible in the verification label).
        requireExpectedBehavior: pw.requireExpectedBehavior !== false,
        // Same doctrine for the declared kind; a no-op when expectedKind is absent.
        requireExpectedKind: pw.requireExpectedKind !== false,
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

/** M7 prior evidence for one slug — the LAST recorded history row for that
 *  slug, or null when this is the slug's first run (a new domain therefore
 *  starts with no prior: honest, and stated in the corpus README). `historyPath`
 *  is injectable so the M7-resolution pin can drive a temp history file; the
 *  default is the real OUT_DIR history. */
export function priorFor(slug, historyPath = HISTORY_PATH) {
  const history = readJson(historyPath, []);
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

/** F4 (fixes/314_f4_outshine · MA §5 move 3 — the hashed verdict): lift the
 *  tree-run verdict into the driver's M2 evidence. `verdictHash` (compile-
 *  check's FNV-1a `treeVerdictHash`, set on every runnable verdict) is carried
 *  through so the persisted scorecard can cite it; absent ⇒ omitted, never
 *  invented. Exported for the test suite (the driver self-executes only as the
 *  CLI entry). */
export function treeRunToEvidence(outcome) {
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
    // F4 (fixes/314_f4_outshine · MA §5 move 3): the verdict's own hash, when
    // the outcome carries one (compile-check sets it on every runnable
    // verdict); absent ⇒ omitted, never invented.
    verdictHash:
      typeof outcome.verdictHash === "string" && outcome.verdictHash.length > 0 ? outcome.verdictHash : undefined,
    detail,
  };
}

// ---------------------------------------------------------------------------
// Trials, pass@k / pass^k / flakiness + the grader leak scan (W5-L5 T-107.5).
// `checkAcceptance` reads files; since fixes/299 (U1) its `entry-runs` rows
// also run the declared emitted entry through the shared bounded, env-minimal
// oracle (`src/lib/entry-oracle.ts` — the spawn lives there, one truth with
// the product path's treeRun) — nothing here writes into an emitted tree.
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

// (316 I1: the local normalizeEmittedFiles was MOVED to src/lib/entry-oracle.ts —
// imported at the top; the leftover declaration here was the duplicate-symbol
// SyntaxError that aborted this driver's leg.)

// ---------------------------------------------------------------------------
// fixes/299 (U1 — closes the A3-f05 TODO; Q4 item a): `entry-runs` is a REAL,
// bounded, honest runtime evaluation. Before this lane the row pushed
// `pending` and never failed — the acceptance gate's one never-failing clause.
// W44·A1 (fixes/318): the machinery (budget clamp, stream tail, env allowlist,
// the bounded spawn itself) MOVED VERBATIM to the shared oracle
// `src/lib/entry-oracle.ts` — one truth with the product path's treeRun. The
// driver keeps this single-row seam as a thin delegate so the eval side and
// the tree side can never drift.
// ---------------------------------------------------------------------------

/** fixes/299 (U1): one `entry-runs` row, evaluated for real — delegated to the
 *  shared oracle (`runEntryOracle`): status ∈ { "pass", "fail", "ui-shell" } +
 *  a human detail; bounded spawn over the emitted dir, env-minimal, row budget
 *  clamped (entry-oracle.ts owns the contract). Reads + spawns only; never
 *  writes. */
export function evaluateEntryRunsRow(row, emittedDir, has) {
  return runEntryOracle(row, emittedDir, has);
}

/** W40·N4 (§R7-f03/f04) + fixes/299 (U1) + W44·A1 (fixes/318): evaluate the
 *  grader's declared `expectedBehavior` rows against the EMITTED TREE (the
 *  manifest + package.json) — never against text presence in the brief. The
 *  row loop and the record are DELEGATED to the shared oracle
 *  (`checkEntryContract` over `manifestHas`/`manifestFind`) — the module's
 *  record shape is byte-identical to what this function has always produced
 *  (key order included; entry-oracle.ts EntryContractRecord). Row statuses:
 *  file-exists / package-target-exists / entry-runs — the RUNTIME row is a
 *  REAL bounded, env-minimal spawn (`runEntryOracle`): a broken artifact
 *  FAILS the row, never a silent pass; a ui-shell row reads the verified
 *  structural skip. `ok` = no row FAILED (a ui-shell skip does not fail a
 *  tree, exactly as treeRun's entryGreen reads it); `complete` = no runtime
 *  row still awaits evidence. Reads files + runs the declared entry; never
 *  writes. */
export function checkExpectedBehavior(grader, emittedDir, emittedFiles) {
  const files = normalizeEmittedFiles(emittedFiles);
  const declaredRows = Array.isArray(grader.expectedBehavior) ? grader.expectedBehavior : [];
  return checkEntryContract(declaredRows, emittedDir, manifestHas(files), manifestFind(files));
}

/** W40·N4 (§R7-f04): assert the emitted README's Kind line against the
 *  grader's declared `expectedKind`. Returns null when the grader declares no
 *  kind (a v1 grader — nothing to assert). Fail-closed: a tree without a
 *  readable README Kind line FAILS the assertion rather than skipping it. */
export function checkExpectedKind(grader, emittedDir, emittedFiles) {
  const expected = typeof grader.expectedKind === "string" && grader.expectedKind.trim() ? grader.expectedKind.trim() : null;
  if (expected === null) return null;
  const files = normalizeEmittedFiles(emittedFiles);
  const rel = files.find((f) => f === "README.md" || f.endsWith("/README.md")) || null;
  let text = null;
  if (rel) {
    try {
      text = readFileSync(join(emittedDir, rel), "utf8");
    } catch {
      text = null;
    }
  }
  if (text === null) {
    return {
      expected,
      actual: null,
      ok: false,
      reason: "README.md absent/unreadable in the emitted tree — the Kind line cannot be verified",
    };
  }
  const m = text.match(/\*\*Kind:\*\*\s*([a-z-]+)/);
  const actual = m ? m[1] : null;
  if (actual === null) {
    return {
      expected,
      actual,
      ok: false,
      reason: 'README.md carries no "**Kind:** <kind>" line — the emitted kind cannot be verified',
    };
  }
  return actual === expected
    ? { expected, actual, ok: true }
    : {
        expected,
        actual,
        ok: false,
        reason: `emitted kind "${actual}" ≠ expectedKind "${expected}" — the fixture was mis-kinded (keyword table / declared-kind drop)`,
      };
}

/** W40·N4: the honest one-line verification label the acceptance record and
 *  the CLI carry: what was actually verified for this trial. Legacy graders
 *  read "files+content only"; a declared behavior block names its row math.
 *  fixes/299 (U1): a ui-shell structural skip is named (it is neither a pass
 *  nor a failure — the reader must be able to see it). */
function verificationLabel(behavior) {
  if (!behavior || behavior.declared === 0) return "files+content only";
  const bits = [`${behavior.passed}/${behavior.declared} rows pass`];
  if (behavior.failed > 0) bits.push(`${behavior.failed} FAILED`);
  if (behavior.uiShell > 0) bits.push(`${behavior.uiShell} ui-shell skip${behavior.uiShell === 1 ? "" : "s"}`);
  if (behavior.pending > 0) bits.push(`${behavior.pending} pending runtime evidence`);
  return `files+content+behavior (${bits.join(", ")})`;
}

/** Run-side acceptance assertions (107 §8 steal): the grader's declared
 *  expectedFiles / expectedContent checked against the EMITTED tree by the
 *  driver — declared before the run, applied from outside the tree. W40·N4:
 *  the same record also carries the evaluated `expectedBehavior` rows, the
 *  declared-kind assertion and the honest `verification` label. */
export function checkAcceptance(grader, emittedDir, emittedFiles) {
  const files = normalizeEmittedFiles(emittedFiles);
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
  // W40·N4: the behavioral + kind halves ride the same acceptance record (all
  // read from OUTSIDE the tree). `behaviorOk` follows checkExpectedBehavior's
  // no-FAILED-row rule; `kindOk` is null when the grader declares no kind.
  const behavior = checkExpectedBehavior(grader, emittedDir, files);
  const kind = checkExpectedKind(grader, emittedDir, files);
  return {
    filesOk: missingFiles.length === 0,
    missingFiles,
    contentOk: failedContent.length === 0,
    failedContent,
    checked: { expectedFiles: grader.expectedFiles.length, expectedContent: grader.expectedContent.length },
    behavior,
    behaviorOk: behavior.ok,
    kind,
    kindOk: kind === null ? null : kind.ok,
    verification: verificationLabel(behavior),
  };
}

/** Path of one trial's emit dir. 1 trial = the legacy `<out>/<slug>/` path
 *  (byte-identical for every existing consumer); N > 1 trials emit to FRESH
 *  sibling workspaces `<out>/<slug>--trial-<i>/` so no trial can inherit
 *  another's tree. */
export function trialEmitDir(outDir, slug, trial, trials) {
  return trials <= 1 ? join(outDir, slug) : join(outDir, `${slug}--trial-${trial}`);
}

// ---------------------------------------------------------------------------
// W23-L1 (fixes/262) — per-trial MODEL EVIDENCE: the provider call tap +
// served-id/usage/cost folding + the clean emit target.
//
// Run #3's results.json recorded NO model ids and NO usage anywhere: a
// flash-only run was not verifiable from the row and the spend was invisible
// (context for this lane). The driver now installs the provider's opt-in call
// tap (`src/lib/llm/providers/deepseek.ts` `setLlmCallTap` — the one funnel
// every keyed call passes through) once per keyed run, resets it per trial,
// and folds the trial's records into the row:
//   servedModels     — every id the provider READ BACK (never the requested
//                      constant; a refused call served nothing, so it adds none);
//   usage            — measured {promptTokens, completionTokens, totalTokens}
//                      (+ `cachedPromptTokens` when the window reported the
//                      vendor cache-read split — absent otherwise, never a
//                      fabricated 0), folded via the T-107.6 ledger helpers
//                      (`recordSpend` / `totalTokens` — consume, never
//                      recompute);
//   estimatedCostUsd — an ESTIMATE from caller-supplied per-1M prices
//                      (`RAPIDTOOL_PRICE_INPUT_PER_M` / `RAPIDTOOL_PRICE_OUTPUT_PER_M`
//                      env wins; else the repo's documented list-price row,
//                      OFF-PEAK cache-miss rates — see the table below),
//                      labelled by `costBasis`. An unknown model NEVER gets a
//                      guessed price (null + reason — 101 §4.5).
// Nothing is invented when nothing was measured: keyless trials (and a keyed
// run whose tap could not install) record `usage: null` / `estimatedCostUsd:
// null` — never fabricated zeros.
// ---------------------------------------------------------------------------

/** Documented DeepSeek list prices (USD per 1M tokens) for the cost ESTIMATE,
 *  from the repo's own research table (`research/multiagent/90_LEAPFROG.md`
 *  §12.3.1 pricing row, [H2]-sourced): OFF-PEAK, cache-MISS input + output.
 *  The usage record carries no cache-hit and no peak/off-peak data, so the
 *  estimate is a labelled off-peak/cache-miss figure, not a bill. Both the
 *  request aliases and the vendor-SERVED ids are keyed (the vendor serves
 *  `deepseek-flash` for the requested alias `deepseek-v4-flash`). */
export const DEEPSEEK_PRICE_TABLE_USD_PER_M = Object.freeze({
  "deepseek-v4-flash": { inputPerMillion: 0.22, outputPerMillion: 0.66 },
  "deepseek-flash": { inputPerMillion: 0.22, outputPerMillion: 0.66 },
  "deepseek-v4-pro": { inputPerMillion: 0.66, outputPerMillion: 1.98 },
  "deepseek-v4-flash-vision-exp": { inputPerMillion: 0.22, outputPerMillion: 0.66 },
});

const PRICE_BASIS_TABLE =
  "DeepSeek off-peak cache-miss list rates, USD per 1M tokens (research/multiagent/90_LEAPFROG.md §12.3.1 [H2]) — an estimate, not a bill: peak windows (01:00–04:00 & 06:00–10:00 UTC Mon–Fri) bill 2x and cache-hit reads are cheaper";

/** Resolve per-1M prices for a trial's served models: operator env first
 *  (`RAPIDTOOL_PRICE_INPUT_PER_M` / `RAPIDTOOL_PRICE_OUTPUT_PER_M`, the
 *  101 §4.5 `RAPIDTOOL_PRICE_<PREFIX>` idiom), else the documented table.
 *  Returns `{ prices: null, basis }` when no honest price exists — the caller
 *  then records `estimatedCostUsd: null` (never invents a figure). */
export function resolvePricesForModels(servedModels) {
  const envIn = Number(process.env.RAPIDTOOL_PRICE_INPUT_PER_M);
  const envOut = Number(process.env.RAPIDTOOL_PRICE_OUTPUT_PER_M);
  if (Number.isFinite(envIn) && envIn > 0 && Number.isFinite(envOut) && envOut > 0) {
    return {
      prices: { inputPerMillion: envIn, outputPerMillion: envOut },
      basis: `operator prices via RAPIDTOOL_PRICE_INPUT_PER_M=${envIn} / RAPIDTOOL_PRICE_OUTPUT_PER_M=${envOut} (USD per 1M tokens)`,
    };
  }
  const models = Array.isArray(servedModels) ? servedModels : [];
  if (models.length === 0) {
    return { prices: null, basis: "no served model id was read back — nothing to price" };
  }
  const missing = models.filter((m) => !DEEPSEEK_PRICE_TABLE_USD_PER_M[m]);
  if (missing.length > 0) {
    return {
      prices: null,
      basis: `no documented price for ${missing.join(", ")} — estimatedCostUsd stays null (never invented); set RAPIDTOOL_PRICE_INPUT_PER_M/RAPIDTOOL_PRICE_OUTPUT_PER_M to price it`,
    };
  }
  // Mixed-served-model trials take the HIGHER catalogue line (conservative —
  // the estimate never under-bills a flash+pro mix).
  const prices = models
    .map((m) => DEEPSEEK_PRICE_TABLE_USD_PER_M[m])
    .reduce((a, b) => (b.outputPerMillion > a.outputPerMillion ? b : a));
  return { prices: { ...prices }, basis: PRICE_BASIS_TABLE };
}

/** Fold one trial's provider call records into the row evidence block. Pure.
 *  `null` input means "nothing was measured" (keyless / tap unavailable) —
 *  the caller records nulls rather than zeros. */
export function llmEvidenceFromCallRecords(records) {
  if (!Array.isArray(records)) return null;
  let ledger = emptyLedger();
  const servedModels = [];
  let failedCalls = 0;
  for (const r of records) {
    if (!r || typeof r !== "object") continue;
    const served = typeof r.servedModel === "string" ? r.servedModel.trim() : "";
    if (served && !servedModels.includes(served)) servedModels.push(served);
    if (r.ok !== true) failedCalls += 1;
    if (typeof r.promptTokens === "number" || typeof r.completionTokens === "number") {
      ledger = recordSpend(ledger, {
        promptTokens: typeof r.promptTokens === "number" ? r.promptTokens : 0,
        completionTokens: typeof r.completionTokens === "number" ? r.completionTokens : 0,
        // W43/A5 (fixes/309_a5_evdocs.md — B2's "FOR B4" read-side fold): the
        // vendor cache-read split is forwarded ONLY when the tap record
        // measured it — absent stays absent, so a legacy record folds to the
        // byte-identical 3-key ledger (`recordSpend` merges it sticky-
        // additive). `cacheMissTokens` is deliberately NOT forwarded: it is
        // not a `CACHE_LEDGER_FIELD` (a no-op there) — tap-record-only key.
        ...(typeof r.cachedPromptTokens === "number" ? { cachedPromptTokens: r.cachedPromptTokens } : {}),
      });
    }
  }
  const usage = {
    promptTokens: ledger.promptTokens,
    completionTokens: ledger.completionTokens,
    totalTokens: totalTokens(ledger),
    // W43/A5: measured cache reads are visible to the row when the window
    // reported them — omitted entirely otherwise (null-when-absent, never a
    // fabricated 0). `estimateCostUsd` prices the cached subset at the full
    // input rate until a documented cached-input price exists (the table
    // carries none — it over-bills, never under-bills).
    ...(typeof ledger.cachedPromptTokens === "number" ? { cachedPromptTokens: ledger.cachedPromptTokens } : {}),
  };
  let estimatedCostUsd = null;
  let costBasis;
  if (records.length === 0) {
    estimatedCostUsd = 0;
    // W24/B2 (fixes/263): name the assumption — an empty window proves the TAP
    // observed nothing, which is not the same claim as "the vendor billed
    // nothing" (a call through a non-tapped provider path would not appear
    // here). `llmCalls: 0` below is the measurement; this string must not
    // overclaim it.
    costBasis =
      "the provider call tap OBSERVED no calls in this trial's window (no cost estimate; a call through a non-tapped provider path would not appear here)";
  } else {
    const pricing = resolvePricesForModels(servedModels);
    if (pricing.prices) {
      estimatedCostUsd = Number(estimateCostUsd(usage, pricing.prices).toFixed(6));
    }
    costBasis = pricing.basis;
  }
  return {
    servedModels,
    usage,
    estimatedCostUsd,
    costBasis,
    llmCalls: records.length,
    failedCalls,
    noBalance: records.some((r) => r && r.code === "RT_E_LLM_NO_BALANCE"),
  };
}

/** The active trial's tap buffer (one process = one sequential run, so one
 *  slot is honest — nothing to interleave). */
let activeTrialTap = null;
let llmCallTapInstalled = false;

/** Install the provider call tap once per process (keyed runs only). Returns
 *  false when the provider surface lacks the tap — the caller records nulls
 *  and says so, never invents usage. */
export async function installLlmCallTap() {
  if (llmCallTapInstalled) return true;
  try {
    const ds = await import(pathToFileURL(join(LIB_DIR, P6_DS_SPEC)).href);
    if (typeof ds.setLlmCallTap !== "function") return false;
    ds.setLlmCallTap((record) => {
      if (activeTrialTap) activeTrialTap.push(record);
    });
    llmCallTapInstalled = true;
    return true;
  } catch {
    return false;
  }
}

export function llmCallTapIsInstalled() {
  return llmCallTapInstalled;
}

/** Open a trial's measurement window (resets the buffer — a crashed trial's
 *  leftover records can never leak into the next trial's row). */
export function beginTrialCallTap() {
  activeTrialTap = [];
}

/** Close the window and return the trial's records. */
export function endTrialCallTap() {
  const records = activeTrialTap ?? [];
  activeTrialTap = null;
  return records;
}

/**
 * W23-L1 — the per-trial CLEAN emit target. Run #3 hit `foreign files in emit
 * dir: src/generated/get-property.ts` — a stale tree from an earlier run at
 * the same path. `--force` would NOT be the honest fix (force KEEPS foreign
 * files, so the tree-run verdict would weight a tree the current run never
 * emitted); instead the driver removes its OWN previous workspace at this
 * exact path before emitting, so every trial's emit starts empty and the
 * verdict judges exactly the current tree.
 *
 * Guards: only paths INSIDE the eval out dir are ever removed (EVAL_OUT_DIR
 * is operator-supplied; the driver never deletes outside its own output
 * tree), and a clean failure is recorded and left to the emitter's normal
 * foreign-file rules (never silently swallowed).
 */
export function prepareCleanEmitDir(dir, outDir = OUT_DIR) {
  const target = resolve(dir);
  const root = resolve(outDir);
  const rel = relative(root, target);
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
    return {
      dir: target,
      cleaned: false,
      note: `refused to clean ${target}: outside the eval out dir ${root} — the driver only cleans its own output tree`,
    };
  }
  if (!existsSync(target)) {
    return { dir: target, cleaned: false, note: "no prior workspace at this path — first emit into it" };
  }
  try {
    rmSync(target, { recursive: true, force: true });
    return {
      dir: target,
      cleaned: true,
      note: "prior workspace removed before emit (per-trial clean target — no foreign-file refusal, no mixed trees)",
    };
  } catch (e) {
    return {
      dir: target,
      cleaned: false,
      note: `clean failed (${e instanceof Error ? e.message : String(e)}) — emit proceeds under the normal foreign-file rules`,
    };
  }
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

// ---------------------------------------------------------------------------
// OV-7 (W19-L4) — the grader FREEZE property + the brief leak scan.
//
// 107 lesson 5: graders freeze OUTSIDE the agent — a grader written (or edited)
// after seeing the run it grades is not a grader. Two facts make the recorded
// bar trustworthy here:
//   1. LOAD-ONCE — `planTargets` resolves each case's grader exactly once,
//      before the first trial; every trial of that case scores against the same
//      in-memory object (never a per-trial re-read of the file).
//   2. UNMOVED — the raw bytes of every grader file are fingerprinted before
//      the first entry runs and re-verified before results.json / history.json
//      are written. A byte change mid-run means the bar moved while the run was
//      in flight: the run is stamped `graderFreeze.ok=false` with the changed
//      paths, the affected scores are INVALID, and the fact is printed LOUDLY —
//      never silently averaged in.
// FNV-1a is an integrity hash (house rule: not cryptographic): it detects an
// edit, not an adversary. A file edited and reverted between the two reads is
// outside this check's reach — that residual is stated, not hidden.
// ---------------------------------------------------------------------------

/** Raw-byte fingerprint of one grader file: the bytes an editor mutates. */
export function graderFreezeFingerprint(graderPath) {
  try {
    const raw = readFileSync(graderPath, "utf8");
    return { path: graderPath, bytes: raw.length, hash: String(fnv1a(raw)), readable: true };
  } catch {
    return { path: graderPath, bytes: null, hash: null, readable: false };
  }
}

/** Re-verify the fingerprints taken before the run. `changed` lists every
 *  grader whose file is now missing/unreadable or byte-different; `ok` is true
 *  only when every frozen grader is byte-identical. `slug` rides through when
 *  the fingerprints were built per corpus entry. */
export function verifyGraderFreeze(fingerprints) {
  const changed = [];
  for (const fp of fingerprints) {
    const now = graderFreezeFingerprint(fp.path);
    if (!now.readable) {
      changed.push({ slug: fp.slug ?? null, path: fp.path, reason: "unreadable-since-start", hashAtStart: fp.hash ?? null, hashNow: null });
    } else if (now.hash !== fp.hash || now.bytes !== fp.bytes) {
      changed.push({ slug: fp.slug ?? null, path: fp.path, reason: "bytes-changed-mid-run", hashAtStart: fp.hash ?? null, hashNow: now.hash });
    }
  }
  return { checked: fingerprints.length, ok: changed.length === 0, changed };
}

/** OV-7 leak audit — the AGENT-FACING surface of a corpus case. `graderLeakScan`
 *  covers the emitted tree; the brief is the OTHER direction grader text can
 *  escape through: `createProject` receives `entry.brief` + `entry.name`, so any
 *  acceptance-bar text (or grader file name) baked into the brief hands the
 *  agent the bar it is graded against (230 §OV-7 trap: "a leak scan that only
 *  checks the emitted tree misses grader text baked into the *brief*"). Pure;
 *  markers are the grader's own bar + file name (graderLeakMarkers). */
export function briefLeakScan(entry, grader) {
  const fields = [
    { field: "brief", text: typeof entry.brief === "string" ? entry.brief : "" },
    { field: "name", text: typeof entry.name === "string" ? entry.name : "" },
  ];
  const markers = graderLeakMarkers(grader);
  const hits = [];
  for (const { field, text } of fields) {
    for (const m of markers) {
      if (text.includes(m.text)) hits.push({ field, marker: m.label });
    }
  }
  return { fields: fields.map((f) => f.field), markers: markers.map((m) => m.label), hits, leaked: hits.length > 0 };
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
// OV-35(a) / OV-27 — the Step-0 preflight: LLM reachability through the P6
// separate-specifier path (fixes/244, W16-L1).
//
// `upgradeP6Keyed` (engine.ts:2851-2885) imports the provider and the codegen
// module through RUNTIME-CONCATENATED specifiers (`"./deepseek." + "server.ts"`,
// `"./codegen." + "server.ts"`) so the client bundle never statically pulls the
// server modules in. The open doubt (226 A1 / fixes/228 D1.1): under the bare
// Node host the CLI/eval drivers run on, the server-fn `llmStatus` reports
// configured:false even with a key set and `callModel` needs an
// AsyncLocalStorage Start context — does the P6 path actually behave? This
// probe answers from the SAME specifier idiom, keyless with a dummy key: it
// proves (i) engine + both specifiers load on this host, (ii) the provider's
// `configured` probe is true through them, (iii) the wire is REACHED — the
// vendor answers, and a dummy key makes that answer a 401. What it CANNOT
// prove without a real key: that a completion returns (model reach) and that a
// full liveP6Synthesis converges — Step 0 itself measures those.
// ---------------------------------------------------------------------------

const LIB_DIR = join(ROOT, "src", "lib");
/** The P6 concatenated-specifier idiom, byte-for-byte (engine.ts:2853/:2870). */
const P6_DS_SPEC = "./deepseek." + "server.ts";
const P6_CODEGEN_SPEC = "./codegen." + "server.ts";

function probeErrorText(e) {
  return e instanceof Error ? e.message : String(e);
}

/** One coded class per preflight ending (OV-35(b), the `235` §2 row-3 pin).
 *  The four demanded endings are class- AND code-distinct: not-configured →
 *  RT_E_LLM_NOT_CONFIGURED · 401 → RT_E_LLM_REJECTED (the registry's own 401
 *  doc) · 402 → RT_E_LLM_NO_BALANCE (W23-L1: the vendor's balance class has
 *  its OWN code — never conflated with the session budget
 *  RT_E_BUDGET_EXHAUSTED or a generic refusal; a broke wallet is not a
 *  budget stop) · 400 →
 *  RT_E_VALIDATION (the request the vendor received failed its validation; the
 *  detail carries the requested model id — D1.4's drift question). Every other
 *  ending classifies too; a `null` code means "not a failure" (wire-ok) or "no
 *  wire evidence" (configured-unprobed). Pure — no network, no env reads.
 *  The JSDoc param is load-bearing under `checkJs`: a destructured parameter
 *  with any default infers its type from those defaults alone, so `configured`
 *  (no default) would read as an unknown property at every call site.
 *  @param {{configured?: boolean, wire?: {attempted?: boolean, ok?: boolean, httpStatus?: number|null, code?: string|null, error?: string|null, model?: string|null, requestedModel?: string}|null}} [options] */
export function classifyLlmPreflight({ configured, wire = null } = {}) {
  if (configured !== true) {
    return {
      class: "not-configured",
      code: "RT_E_LLM_NOT_CONFIGURED",
      ok: false,
      wireReached: false,
      detail:
        "no DEEPSEEK_API_KEY in the environment — the keyed path is off by construction (never faked)",
    };
  }
  if (!wire || wire.attempted !== true) {
    return {
      class: "configured-unprobed",
      code: null,
      ok: false,
      wireReached: false,
      detail: "key present and configured:true through the P6 specifiers, but no wire probe ran — wire reach is UNPROVEN",
    };
  }
  if (wire.ok === true) {
    return {
      class: "wire-ok",
      code: null,
      ok: true,
      wireReached: true,
      detail: `wire reach PROVEN — the vendor answered with a completion${wire.model ? ` (served model ${wire.model})` : ""}${typeof wire.httpStatus === "number" ? ` · HTTP ${wire.httpStatus}` : ""}`,
    };
  }
  const status = typeof wire.httpStatus === "number" ? wire.httpStatus : null;
  if (status === 401)
    return {
      class: "auth-rejected",
      code: "RT_E_LLM_REJECTED",
      ok: false,
      wireReached: true,
      detail: "the vendor answered HTTP 401 — the wire IS reached; the KEY was refused (a stale/dummy key reads exactly like this, so do not read any score from a run in this state)",
    };
  if (status === 402)
    return {
      class: "no-balance",
      code: "RT_E_LLM_NO_BALANCE",
      ok: false,
      wireReached: true,
      detail:
        "the vendor answered HTTP 402 — account balance exhausted (Insufficient Balance); the keyed leg CANNOT run (every call would refuse), so NO scored trial may proceed — top up and re-run",
    };
  if (status === 400)
    return {
      class: "request-rejected",
      code: "RT_E_VALIDATION",
      ok: false,
      wireReached: true,
      detail: `the vendor answered HTTP 400 — request/params refused (vendor model-id drift reads exactly like this; requested id: ${wire.requestedModel ?? "(unreported)"})`,
    };
  if (status === 422)
    return {
      class: "params-rejected",
      code: "RT_E_VALIDATION",
      ok: false,
      wireReached: true,
      detail: "the vendor answered HTTP 422 — request params refused by the vendor",
    };
  if (status === 429)
    return {
      class: "rate-limited",
      code: "RT_E_LLM_REJECTED",
      ok: false,
      wireReached: true,
      detail: "the vendor answered HTTP 429 — rate limited; the wire is reached, retry later",
    };
  if (status !== null && status >= 500)
    return {
      class: "provider-unavailable",
      code: "RT_E_LLM_REJECTED",
      ok: false,
      wireReached: true,
      detail: `the vendor answered HTTP ${status} — the wire is reached; the provider itself is erroring`,
    };
  // W24/B2 (fixes/263): only a ≥400 status is a vendor REFUSAL. The old
  // unguarded `status !== null` catch-all swallowed every observed sub-400
  // ending — including a 200 whose content came back EMPTY — as
  // "provider-refused" before the coded branches below could classify it, so
  // `empty-completion` was UNREACHABLE whenever the status was recorded (it
  // always is, via the probe's recording wrapper). The fundedness probe's own
  // contract (`probeFundedness`: "HTTP 200 / wire-ok / empty-completion: an
  // answered 200 means the account paid") depends on this branch being
  // reachable: a funded account whose 1-token probe truncates now reads
  // funded:true instead of funded:null.
  if (status !== null && status >= 400)
    return {
      class: "provider-refused",
      code: "RT_E_LLM_REJECTED",
      ok: false,
      wireReached: true,
      detail: `the vendor answered HTTP ${status} — refusal class not pre-enumerated; read the vendor text`,
    };
  // No HTTP status — transport-level endings.
  const wireCode = typeof wire.code === "string" && wire.code ? wire.code : null;
  if (wireCode === "RT_E_LLM_TIMEOUT")
    return {
      class: "timeout",
      code: "RT_E_LLM_TIMEOUT",
      ok: false,
      wireReached: null,
      detail: "the probe timed out — the wire may or may not have been reached; NOT evidence about quality either way",
    };
  if (wireCode === "RT_E_NETWORK_UNREACHABLE")
    return {
      class: "unreachable",
      code: "RT_E_NETWORK_UNREACHABLE",
      ok: false,
      wireReached: false,
      detail: "the probe never reached the vendor (DNS/connect) — a keyed run cannot leave this host until the network path exists",
    };
  if (wireCode === "RT_E_LLM_NOT_CONFIGURED")
    return {
      class: "not-configured",
      code: "RT_E_LLM_NOT_CONFIGURED",
      ok: false,
      wireReached: false,
      detail: "the provider itself reported not-configured at call time (key disappeared between probe steps)",
    };
  if (wireCode === "RT_E_LLM_REJECTED" && /no text content/.test(String(wire.error ?? "")))
    return {
      class: "empty-completion",
      code: "RT_E_LLM_REJECTED",
      ok: false,
      wireReached: true,
      detail: "the vendor answered but returned no text content — wire reach proven; the model OUTPUT was refused (thinking/truncation class — read the provider's diagnostic)",
    };
  // W23-L1 (fixes/262): the provider's own no-balance class — reached when the
  // 402 status was not observed by the recording wrapper but the coded refusal
  // (or an "Insufficient Balance" body) says the account is unfunded. Same
  // class/code as the status-402 branch above: ONE no-balance ending.
  if (wireCode === "RT_E_LLM_NO_BALANCE" || /insufficient balance/i.test(String(wire.error ?? "")))
    return {
      class: "no-balance",
      code: "RT_E_LLM_NO_BALANCE",
      ok: false,
      wireReached: true,
      detail:
        "the provider refused with the no-balance class (Insufficient Balance — the 402 status was not observed by the probe wrapper, but the coded refusal is unambiguous) — NO scored trial may proceed",
    };
  return {
    class: "internal",
    code: wireCode && /^RT_E_/.test(wireCode) ? wireCode : "RT_E_INTERNAL",
    ok: false,
    wireReached: null,
    detail: String(wire.error ?? "the probe failed without a classifiable code"),
  };
}

/** What the reported class PROVES and what it canNOT prove (no real key). */
export function preflightLimits(cls) {
  switch (cls) {
    case "wire-ok":
      return {
        proves: "one completion round-trip through the P6 specifier path (configured + wire + model text)",
        cannotProve: "that the full liveP6Synthesis journey converges, or that any score is quality — Step 0 measures those",
      };
    case "auth-rejected":
      return {
        proves: "the wire is reachable from this host and the request shape passes to the auth check",
        cannotProve: "that the key can run anything (it was refused) — a real key must pass this probe before any keyed reading",
      };
    case "no-balance":
      return {
        proves: "the wire is reachable from this host and the vendor's billing check answered (HTTP 402)",
        cannotProve: "that ANY call can succeed (account balance exhausted) — top up before any keyed reading; a run in this state is not a measurement",
      };
    case "unreachable":
      return {
        proves: "the probe ran on this host",
        cannotProve: "any vendor reach (DNS/connect failed) — fix the network path first",
      };
    case "not-configured":
      return {
        proves: "the honest keyless state",
        cannotProve: "anything keyed (no key is present)",
      };
    case "configured-unprobed":
      return {
        proves: "configured:true through the P6 specifier",
        cannotProve: "wire reach (no probe was attempted)",
      };
    default:
      return {
        proves: "the probe ran and classified its ending",
        cannotProve: "anything beyond the reported class — read the class detail",
      };
  }
}

/** One-line stdout renderings for the probe (booleans/enums only — the key
 *  VALUE can never appear: nothing key-shaped enters this function). */
export function formatPreflightLines(p) {
  const lines = [];
  lines.push(`preflight: OV-27 reachability · configured=${p.configured} · class=${p.class}${p.code ? ` · code ${p.code}` : ""}`);
  for (const [name, s] of Object.entries(p.specifiers || {})) {
    lines.push(`preflight: specifier ${name}: resolved=${s.resolved}${s.error ? ` · ${s.error}` : ""}`);
  }
  if (p.wire) {
    lines.push(
      `preflight: wire attempted=${p.wire.attempted} · httpStatus=${p.wire.httpStatus ?? "n/a"} · ok=${p.wire.ok}${p.wire.code ? ` · code ${p.wire.code}` : ""}${p.wire.error ? ` · ${String(p.wire.error).slice(0, 200)}` : ""}`,
    );
  } else {
    lines.push("preflight: wire not attempted (key not configured or wire probe disabled)");
  }
  const limits = preflightLimits(p.class);
  lines.push(`preflight: proves: ${limits.proves}`);
  lines.push(`preflight: cannot prove (keyless/dummy key): ${limits.cannotProve}`);
  return lines;
}

/** The OV-27 probe. `fetchImpl` is injectable — tests stub it and NEVER hit the
 *  network; the wire step runs only when `configured` is true and `wire !==
 *  false`. The key VALUE never enters the result. */
export async function probeP6Reachability({ fetchImpl = null, wire = true, timeoutMs = 20_000 } = {}) {
  const out = {
    probe: "OV-27",
    checkedAt: new Date().toISOString(),
    configured: false,
    specifiers: {},
    wire: null,
  };
  // (1) The engine door — the CLI keyed path starts here (liveLayer → upgradeP6Keyed).
  try {
    const engine = await import(pathToFileURL(join(LIB_DIR, "engine.ts")).href);
    out.specifiers.engine = {
      resolved: true,
      liveLayer: typeof engine.liveLayer === "function",
      error: null,
    };
  } catch (e) {
    out.specifiers.engine = { resolved: false, liveLayer: false, error: probeErrorText(e) };
  }
  // (2) The separate specifiers, built exactly as engine builds them.
  let ds = null;
  try {
    ds = await import(pathToFileURL(join(LIB_DIR, P6_DS_SPEC)).href);
    out.specifiers.deepseek = {
      resolved: true,
      isDeepSeekConfigured: typeof ds.isDeepSeekConfigured === "function",
      error: null,
    };
    out.configured =
      typeof ds.isDeepSeekConfigured === "function" && ds.isDeepSeekConfigured() === true;
  } catch (e) {
    out.specifiers.deepseek = { resolved: false, isDeepSeekConfigured: false, error: probeErrorText(e) };
  }
  try {
    const codegen = await import(pathToFileURL(join(LIB_DIR, P6_CODEGEN_SPEC)).href);
    out.specifiers.codegen = {
      resolved: true,
      liveP6Synthesis: typeof codegen.liveP6Synthesis === "function",
      error: null,
    };
  } catch (e) {
    out.specifiers.codegen = { resolved: false, liveP6Synthesis: false, error: probeErrorText(e) };
  }
  // (3) The wire step: ONE bounded call through the provider module the P6 path
  //     resolves to. A status-recording fetch wrapper observes the HTTP status
  //     WITHOUT the provider's byte-stable message parsing being load-bearing.
  const statuses = [];
  const requestedModel =
    ds && ds.DEEPSEEK_MODELS && typeof ds.DEEPSEEK_MODELS.flash === "string"
      ? ds.DEEPSEEK_MODELS.flash
      : null;
  if (out.configured && wire !== false && ds && typeof ds.completeDeepSeek === "function") {
    const baseFetch = fetchImpl ?? globalThis.fetch;
    const recordingFetch = async (...args) => {
      const res = await baseFetch(...args);
      try {
        statuses.push(res && typeof res.status === "number" ? res.status : null);
      } catch {
        statuses.push(null);
      }
      return res;
    };
    let result;
    try {
      result = await ds.completeDeepSeek("Reply with the single word OK.", {
        maxTokens: 8,
        timeoutMs,
        fetch: recordingFetch,
      });
    } catch (e) {
      result = { ok: false, error: `probe call threw: ${probeErrorText(e)}`, code: "RT_E_INTERNAL" };
    }
    out.wire = {
      attempted: true,
      ok: result && result.ok === true,
      httpStatus: statuses.length > 0 ? statuses[statuses.length - 1] : null,
      code: result && typeof result.code === "string" ? result.code : null,
      error: result && result.ok !== true ? String(result.error ?? "").slice(0, 400) : null,
      model: result && result.ok === true ? result.model ?? null : null,
      requestedModel,
    };
  }
  const c = classifyLlmPreflight({ configured: out.configured, wire: out.wire });
  out.class = c.class;
  out.code = c.code;
  out.ok = c.ok;
  out.wireReached = c.wireReached;
  out.detail = c.detail;
  return out;
}

// ---------------------------------------------------------------------------
// W23-L1 (fixes/262) — the FUNDEDNESS probe: the cheapest possible live call
// (maxTokens 1), performed when `--keyed` runs with the key set.
//
// The reachability probe above answers "does a request arrive at the vendor".
// It cannot answer "can this account PAY" — run #3 proved the difference: the
// wire was fine, the wallet was empty, and every synthesis call refused with
// HTTP 402 while the run still produced a scored 3/9 row. This probe is the
// Step-0 gate that closes that hole: ONE 1-output-token call through the SAME
// P6 concatenated-specifier provider the keyed leg uses, classified by the
// SAME `classifyLlmPreflight` (so HTTP 402 is `class: "no-balance"`,
// `code: RT_E_LLM_NO_BALANCE`). `funded` is the probe's own verdict:
//   true  — the vendor served (or billed) the call (HTTP 200 / wire-ok /
//           empty-completion: an answered 200 means the account paid);
//   false — HTTP 402 / the provider's no-balance class ⇒ A SCORED TRIAL MUST
//           NOT RUN (a broke wallet is not a measurement);
//   null  — the probe cannot answer (401 auth, network, timeout) — reported,
//           never guessed into a pass or a fail.
// The key VALUE never enters the result (booleans/enums/statuses only).
// ---------------------------------------------------------------------------

/** One minimal fundedness call. `fetchImpl` is injectable — tests stub it and
 *  NEVER hit the network. The key value never enters the result. */
export async function probeFundedness({ fetchImpl = null, timeoutMs = 20_000 } = {}) {
  const out = {
    probe: "W23-L1-fundedness",
    checkedAt: new Date().toISOString(),
    configured: false,
    attempted: false,
    ok: false,
    funded: null,
    class: null,
    code: null,
    httpStatus: null,
    requestedModel: null,
    servedModel: null,
    detail: null,
  };
  let ds = null;
  try {
    ds = await import(pathToFileURL(join(LIB_DIR, P6_DS_SPEC)).href);
  } catch (e) {
    out.class = "internal";
    out.code = "RT_E_INTERNAL";
    out.detail = `the provider specifier did not resolve on this host: ${probeErrorText(e)}`;
    return out;
  }
  out.configured =
    typeof ds.isDeepSeekConfigured === "function" && ds.isDeepSeekConfigured() === true;
  if (!out.configured) {
    out.class = "not-configured";
    out.code = "RT_E_LLM_NOT_CONFIGURED";
    out.detail =
      "no DEEPSEEK_API_KEY in the environment — fundedness is unaskable by construction (never faked)";
    return out;
  }
  if (typeof ds.completeDeepSeek !== "function") {
    out.class = "internal";
    out.code = "RT_E_INTERNAL";
    out.detail = "the provider specifier resolved without completeDeepSeek — cannot probe";
    return out;
  }
  const requestedModel =
    ds.DEEPSEEK_MODELS && typeof ds.DEEPSEEK_MODELS.flash === "string"
      ? ds.DEEPSEEK_MODELS.flash
      : null;
  out.requestedModel = requestedModel;
  const statuses = [];
  const baseFetch = fetchImpl ?? globalThis.fetch;
  const recordingFetch = async (...args) => {
    const res = await baseFetch(...args);
    try {
      statuses.push(res && typeof res.status === "number" ? res.status : null);
    } catch {
      statuses.push(null);
    }
    return res;
  };
  let result;
  try {
    // THE cheapest call: one output token. maxTokens 1 keeps even a funded
    // probe at ~1 completion token (+ the prompt) — the smallest possible bill.
    result = await ds.completeDeepSeek("OK", {
      maxTokens: 1,
      timeoutMs,
      fetch: recordingFetch,
    });
  } catch (e) {
    result = { ok: false, error: `fundedness probe call threw: ${probeErrorText(e)}`, code: "RT_E_INTERNAL" };
  }
  const wire = {
    attempted: true,
    ok: result && result.ok === true,
    httpStatus: statuses.length > 0 ? statuses[statuses.length - 1] : null,
    code: result && typeof result.code === "string" ? result.code : null,
    error: result && result.ok !== true ? String(result.error ?? "").slice(0, 400) : null,
    model: result && result.ok === true ? result.model ?? null : null,
    requestedModel,
  };
  const c = classifyLlmPreflight({ configured: true, wire });
  out.attempted = true;
  out.ok = c.ok;
  out.class = c.class;
  out.code = c.code;
  out.httpStatus = wire.httpStatus;
  out.servedModel = wire.model;
  out.detail = c.detail;
  out.funded =
    c.class === "no-balance"
      ? false
      : c.class === "wire-ok" || c.class === "empty-completion"
        ? true
        : null;
  return out;
}

/** One-line stdout renderings for the fundedness probe (booleans/enums/
 *  statuses only — the key VALUE can never appear: nothing key-shaped enters
 *  this function). W24/B2 (fixes/263): this is the ONE fundedness renderer —
 *  the call site in `main()` prints these lines instead of hand-rolling a
 *  second, already-drifted copy of line 1 (the old dead-export + duplicate). */
export function formatFundednessLines(p) {
  const lines = [];
  lines.push(
    `preflight: fundedness (1-token probe) · configured=${p.configured} · funded=${p.funded === null ? "unknown" : p.funded}${p.class ? ` · class=${p.class}` : ""}${p.code ? ` · code ${p.code}` : ""}${p.httpStatus !== null && p.httpStatus !== undefined ? ` · httpStatus=${p.httpStatus}` : ""}${p.servedModel ? ` · served=${p.servedModel}` : ""}`,
  );
  if (p.detail) lines.push(`preflight: fundedness detail: ${p.detail}`);
  if (p.funded === false) {
    lines.push(
      "preflight: NO-BALANCE — the account cannot pay for a single call; a scored keyed trial will NOT run (top up the account or switch keys and re-run)",
    );
  } else if (p.funded === true) {
    lines.push(
      `preflight: fundedness proven — the account served a ${p.servedModel ? `"${p.servedModel}" ` : ""}completion (HTTP ${p.httpStatus ?? "200"})`,
    );
  } else {
    lines.push(
      "preflight: fundedness unproven — this class cannot answer whether the account can pay; it is neither a pass nor a fail",
    );
  }
  return lines;
}

// ---------------------------------------------------------------------------
// The drain: full pipeline with stock-HITL approvals via the driver.
// ---------------------------------------------------------------------------

/** fixes/237 (C-2 / `223` §4, M9 leg) — is a drain round's outcome TERMINAL?
 *  The seven `RunOutcome` values live in `src/lib/headless.ts:527`. A round is
 *  terminal when no further round can change the project's fate:
 *  "complete"/"blocked"/"error" are the classic stops and "dod" is the T0.4
 *  hard-DoD stop (headless.ts:587-606 — stopped:true, cursor unmoved; WB-2:
 *  treating it as progress spun the 80-round guard and ended "stalled", M9=0).
 *  It is NOT terminal for "hitl" (the drain approves the park and continues),
 *  nor for "progress" / "cap" (keep looping under the round guard). Pure +
 *  exported so `scripts/run-eval.test.mjs` pins all seven values. */
export function isTerminalDrainOutcome(outcome) {
  return (
    outcome === "complete" || outcome === "blocked" || outcome === "error" || outcome === "dod"
  );
}

// ---------------------------------------------------------------------------
// OV-35(b) — failure-class triage (fixes/244, W16-L1): a coded class for EVERY
// drain ending and every RunOutcome value. `stalled` was the silent ending —
// the approve-throw and round-guard stalls returned no code, so the stop
// evidence fell back to the RT_EVAL_STALL harness label (W15-L2's
// registry-boundary decision keeps that label out of src/lib/errors.ts as a
// real code — but it must not be the only record of a stall). Every stall path
// now carries the registry code for its actual cause:
//   · an unapprovable gate (approve threw)   → RT_E_GATE_PENDING
//   · the 80-round harness guard             → RT_E_BUDGET_EXHAUSTED
//   · a post-journey non-complete terminal   → the RunOutcome's own code
// classifyDrainEnding() is the single classifier the drain and the tests share;
// an UNC coded stall can never classify silently (it reports RT_E_UNKNOWN plus
// the emitter-bug detail).
// ---------------------------------------------------------------------------

/** Every RunOutcome value (headless.ts:527) with its coded class. `code: null`
 *  = not a failure (complete) or not a stop (hitl/progress parks). */
export const RUN_OUTCOME_CLASSES = Object.freeze({
  hitl: { class: "hitl-parked", code: null, terminal: false },
  complete: { class: "complete", code: null, terminal: true },
  blocked: { class: "blocked", code: "RT_E_GATE_PENDING", terminal: true },
  error: { class: "error", code: "RT_E_INTERNAL", terminal: true },
  progress: { class: "in-progress", code: null, terminal: false },
  cap: { class: "iteration-cap", code: "RT_E_BUDGET_EXHAUSTED", terminal: false },
  dod: { class: "hard-dod", code: "RT_E_GATE_PENDING", terminal: true },
});

/** Classify one RunOutcome. An unknown value is never silent: it reports the
 *  unknown-outcome class with RT_E_INTERNAL. */
export function classifyRunOutcome(outcome) {
  const hit = RUN_OUTCOME_CLASSES[outcome];
  if (!hit) {
    return { outcome: outcome ?? null, class: "unknown-outcome", code: "RT_E_INTERNAL", terminal: null };
  }
  return { outcome, ...hit };
}

/** Classify one drain ending. `position` is drainPipeline's own vocabulary:
 *  p6-gate (intentional handoff) · dod (coded hard stop, C-2) · terminal (a
 *  RunOutcome terminal) · stalled (the failure the triage exists to kill — now
 *  always accompanied by a code).
 *  @param {{outcome?: string|null, position?: string|null, code?: string|null}} [ending] */
export function classifyDrainEnding({ outcome = null, position = null, code = null } = {}) {
  switch (position) {
    case "p6-gate":
      return { position, outcome, class: "p6-handoff", code: null, ok: true };
    case "dod":
      return { position, outcome, class: "hard-dod", code: code ?? "RT_E_GATE_PENDING", ok: false };
    case "terminal": {
      const out = classifyRunOutcome(outcome);
      return { position, outcome, class: out.class, code: code ?? out.code, ok: out.class === "complete" };
    }
    case "stalled": {
      if (code === "RT_E_GATE_PENDING")
        return { position, outcome, class: "gate-unapprovable", code, ok: false };
      if (code === "RT_E_BUDGET_EXHAUSTED")
        return { position, outcome, class: "iteration-budget-exhausted", code, ok: false };
      return {
        position,
        outcome,
        class: "stalled-uncoded",
        code: typeof code === "string" && /^RT_E_/.test(code) ? code : "RT_E_UNKNOWN",
        ok: false,
        detail: "a stall reached the classifier without a registry code — that is an emitter bug, reported honestly instead of silently",
      };
    }
    default:
      return {
        position,
        outcome,
        class: "unknown-position",
        code: "RT_E_INTERNAL",
        ok: false,
        detail: `unknown drain position ${JSON.stringify(position)}`,
      };
  }
}

/** Build a drain return value with its classified ending attached. */
function endingRecord({ p, res, approved, onTime, stall, position, code = null }) {
  return {
    p,
    res,
    approved,
    onTime,
    stall,
    position,
    code,
    ending: classifyDrainEnding({ outcome: res ? res.outcome : null, position, code }),
  };
}

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
 * and then let the journey re-synthesize #2; fixes/146 §2 divergence #4).
 *  @param {any} project
 *  @param {{keyed?: boolean, p6Gate?: boolean}} [options] */
export async function drainPipeline(project, { keyed, p6Gate = false } = {}) {
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
        // loudly with a code instead of spinning silently (M9). OV-35(b): the
        // stall carries RT_E_GATE_PENDING — a gate that stays unresolved is
        // exactly the registry's meaning for it (the RT_EVAL_STALL label stays
        // only as the last-resort stopCode fallback, never the sole record).
        return endingRecord({
          p,
          res,
          approved,
          onTime: false,
          stall: e instanceof Error ? e.message : String(e),
          position: "stalled",
          code: "RT_E_GATE_PENDING",
        });
      }
      if (p6Gate && gatePhase === 5) {
        return endingRecord({ p, res, approved, onTime: true, stall: null, position: "p6-gate" });
      }
      continue;
    }
    if (isTerminalDrainOutcome(res.outcome)) {
      if (res.outcome === "dod") {
        // fixes/237 (C-2 / `223` §4 / WB-2): a hard-DoD stop is TERMINAL. The
        // T0.4 outcome ("dod", stopped:true — headless.ts:587-606) means
        // enforceDod refused to leave a red-gated phase; nothing can advance,
        // so re-entering this loop for the 80-round guard only appends ~80
        // dod.blocked rows and returns a SILENT "stalled" (M9=0). Stop on the
        // FIRST dod round: the hard-DoD message is the stall evidence and
        // RT_E_GATE_PENDING is the code the wild path already uses for the
        // same hard block (engine.ts:3571) — M9's loud coded-stop branch.
        const events = Array.isArray(res.events) ? res.events : [];
        const dodMsg =
          events.filter((e) => typeof e === "string" && e.includes("DoD unmet")).pop() ??
          events[events.length - 1] ??
          `P${p.currentPhase} DoD unmet — hard gate blocks advance.`;
        return endingRecord({
          p,
          res,
          approved,
          onTime: true,
          stall: dodMsg,
          position: "dod",
          code: "RT_E_GATE_PENDING",
        });
      }
      // OV-35(b): a terminal ending carries its RunOutcome's own code (null
      // only for `complete`) — a `blocked`/`error` end is no longer uncoded.
      return endingRecord({
        p,
        res,
        approved,
        onTime: true,
        stall: null,
        position: "terminal",
        code: classifyRunOutcome(res.outcome).code,
      });
    }
    // progress/cap — keep looping under the round guard.
  }
  // OV-35(b): the 80-round guard is a budget exhaustion, coded — not a silent
  // stall. (Was: no code at all; the stop evidence fell back to RT_EVAL_STALL.)
  return endingRecord({
    p,
    res: lastRes,
    approved,
    onTime: false,
    stall: "drain iteration cap reached without a terminal state",
    position: "stalled",
    code: "RT_E_BUDGET_EXHAUSTED",
  });
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
  // W23-L1 (fixes/262): open the trial's model-call measurement window BEFORE
  // the first keyed call (the journey's synthesis). Keyless trials never tap.
  if (mode === "keyed") beginTrialCallTap();
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
      // The floor drain could not reach the P6 gate — the journey never ran;
      // whatever stop the drain ended on stands as-is (fixes/237 C-2: a
      // hard-DoD stop is now its own coded terminal position, so a floor
      // hard-stop is loud + coded rather than a silent stall).
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
  //
  //    W23-L1 (fixes/262): the per-trial CLEAN target runs FIRST — the
  //    driver's own prior workspace at this path is removed, so the emit can
  //    never refuse on stale foreign files (run #3's
  //    `src/generated/get-property.ts`) and the tree-run below can never
  //    weight a mixed tree the current run did not emit.
  const cleanReport = prepareCleanEmitDir(emitDir);
  if (cleanReport.cleaned) {
    console.log(`      emit-dir: removed the trial's prior workspace at ${cleanReport.dir} (per-trial clean target)`);
  }
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
    // T9.3 promotion (W44 · G3 · applied from fixes/319_f3_promote §C): a
    // green M2 run promotes the emitted artifact's OWN record to the tested
    // stamp + evidence hash — the handover artifact then carries the machine
    // verdict it earned. Additive evidence only (`treeRunToEvidence` pins
    // assert fields, never a frozen key set — run-eval.test.mjs:171-191),
    // best-effort: the M2 verdict itself stands regardless.
    if (runOutcome && runOutcome.ok === true && treeEv) {
      try {
        const prom = await promoteEmittedTreeTested(finalProject, emitDir, runOutcome);
        if (prom.promoted) treeEv.minted = true;
      } catch {
        /* promotion is best-effort evidence; the M2 verdict stands */
      }
    }
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

  // OV-7: the agent-facing surface is the OTHER leak direction — the brief must
  // not carry the bar the case is graded against. Printed once per case (trial
  // 1), recorded on every trial's row.
  const briefLeak = briefLeakScan(entry, grader);
  if (briefLeak.leaked && trial === 1) {
    console.log("");
    console.log(`!!!!! GRADER TEXT IN THE AGENT-FACING BRIEF — ${slug}:`);
    for (const h of briefLeak.hits) console.log(`      ${h.marker} in ${h.field}`);
    console.log("      the agent would read the bar it is graded against — that case's score is not a measurement");
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
  // W23-L1 (fixes/262) — close the trial's measurement window and fold the
  // provider's own call records (keyed only) into the row evidence. Keyless →
  // null: nothing was measured, so the row records nulls, never zeros.
  // W24/B2 (fixes/263): the fold is ALSO gated on the tap actually being
  // installed — an uninstalled tap measured nothing, and folding its empty
  // list would fabricate `usage:{0,0,0}` / `estimatedCostUsd:0` (see the
  // install site in main()).
  const callRecords = mode === "keyed" ? endTrialCallTap() : null;
  const llmEvidence = llmEvidenceFromCallRecords(
    mode === "keyed" && !llmCallTapIsInstalled() ? null : callRecords,
  );
  // A no-balance ending is signalled by ANY of the trial's own evidence: the
  // tap (the provider's coded refusal), a p6.synthesis.* log detail, or the
  // journey's refusal string. The trial then ends `no-balance` — NOT a scored
  // `dod` (run #3's shape: wallet at zero, a 3/9 floor card recorded as if a
  // measurement). A broke wallet must never again be scored as a trial.
  const noBalance =
    mode === "keyed" &&
    Boolean(
      (llmEvidence && llmEvidence.noBalance) ||
        logs.some((l) => l && typeof l.detail === "string" && l.detail.includes("RT_E_LLM_NO_BALANCE")) ||
        (journeyEv && typeof journeyEv.refusal === "string" && journeyEv.refusal.includes("RT_E_LLM_NO_BALANCE")),
    );
  const sealedFlag = drain.res ? drain.res.sealedWithFailures === true : false;
  // fixes/237 (C-2): the drain's OWN coded terminal stop wins — a hard-DoD
  // stop parks with RT_E_GATE_PENDING (the wild path's code for the same
  // condition, engine.ts:3571), so M9's loud-stop branch reads the code of the
  // stop that actually ended the run. Refusal-synthesis codes and the legacy
  // stall code remain the fallbacks.
  const drainStopCode =
    typeof drain.code === "string" && /^RT_E/.test(drain.code) ? drain.code : null;
  // W23-L1 (fixes/262): the no-balance ending wins — the coded stop that
  // actually explains this trial is the wallet, not the drain's downstream
  // gate code (a 402-saturated keyed leg parks on a hard DoD whose REAL cause
  // is the unfunded account).
  const stopCode = noBalance
    ? "RT_E_LLM_NO_BALANCE"
    : drainStopCode
      ? drainStopCode
      : refusedSignal
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

  // F1 (314): the iterate driver's DECISION rides the row (additive `iterate`
  // block; see iterateFactsFor — OFF by default, live firing owner-gated, this
  // leg never regenerates). Recorded from the trial's own card mean + the
  // process session token budget.
  const iterateFacts = iterateFactsFor(card);

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
    // W23-L1 (fixes/262): a no-balance trial ends as its own status — it is
    // NOT the drain's downstream `dod`, and it is NOT a measurement.
    status: noBalance ? "no-balance" : drain.res ? drain.res.outcome : "stalled",
    mode,
    criteria: card.criteria,
    total: card.total,
    mean: Number(card.mean.toFixed(4)),
    baseline: entry.baseline,
    coverage,
    // --- W23-L1 additive keys (keyed-run model/usage/cost evidence) ---
    // servedModels: ids the provider READ BACK (a refusal served nothing).
    // usage/estimatedCostUsd: null when nothing was measured (keyless, or a
    // keyed run whose tap could not install) — never fabricated zeros.
    servedModels: llmEvidence ? llmEvidence.servedModels : [],
    usage: llmEvidence ? llmEvidence.usage : null,
    estimatedCostUsd: llmEvidence ? llmEvidence.estimatedCostUsd : null,
    costBasis: llmEvidence
      ? llmEvidence.costBasis
      : mode === "keyed"
        ? "no measurement — the provider call tap was unavailable this run; usage/cost were NOT recorded (this is not a zero-cost claim)"
        : "keyless trial — no model call and nothing measured",
    // --- end W23-L1 additive keys ---
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
      // W40·N4: the declared-kind + behavior-row facts (evidence, not a copy).
      expectedKind: grader.expectedKind ?? null,
      expectedBehaviorRows: grader.expectedBehavior.length,
    },
    acceptance: { ...acceptance, pass: false }, // `pass` filled per-trial by evaluateEntry
    graderLeak: { scanned: graderLeak.scanned, leaked: graderLeak.leaked, hits: graderLeak.hits },
    // OV-7: the agent-facing half of the leak audit (brief + name vs the bar).
    briefLeak: { fields: briefLeak.fields, leaked: briefLeak.leaked, hits: briefLeak.hits },
    // --- end W5-L5 additive keys ---
    notes: {
      approvedGates: drain.approved,
      treeRunOk: treeEv ? treeEv.ok : false,
      journey: journeyEv ? journeyEv.outcome : null,
      stall: drain.stall,
      // fixes/237 (C-2): the coded terminal stop (null when the drain had no
      // code) — the row evidence M9's loud-stop branch cites. W23-L1: a
      // no-balance trial carries RT_E_LLM_NO_BALANCE here (see above).
      stopCode,
      emitError: handoverEv && !handoverEv.emitted ? handoverEv.emitError ?? null : null,
      p6Refused: refusedSignal,
      // fixes/154 (F1): the floor-gate discriminator this card was scored
      // under — true = ≥1 ok synthesis attempt, false = none (floor card),
      // absent = keyless run (legacy scoring).
      synthesisSucceeded,
      // W23-L1: the no-balance marker — the trial could not run keyed because
      // the account is unfunded; excluded from scoring (see evaluateEntry).
      ...(noBalance
        ? {
            noBalance: true,
            capability: "cannot-run-keyed (account unfunded)",
          }
        : {}),
      // W23-L1: measured call counts (null when the tap was unavailable).
      llmCalls: llmEvidence ? llmEvidence.llmCalls : null,
      failedLlmCalls: llmEvidence ? llmEvidence.failedCalls : null,
      // W23-L1: what the per-trial clean emit target did before this emit.
      emitDirClean: cleanReport,
    },
    // --- F1 (314) additive key: the iterate driver's decision (never engaged
    // here — the live keyed firing is owner-gated; see iterateFactsFor). ---
    iterate: iterateFacts,
    // --- end F1 additive key ---
  };
  // W42·L1-E1 (Q4-c/X2 tail): every entries row carries the funded | unfunded |
  // unmeasured end class — the SAME classifier history.json's rows use
  // (`historyEndClass`, one definition — no drift). Both inputs are already on
  // this object: `acceptance` (pass filled per-trial by evaluateEntry — the
  // literal's placeholder `pass:false` classifies identically to either final
  // boolean verdict: a scored keyed trial IS "funded") + `notes.noBalance` (checked
  // first by the classifier) — so the class computed here cannot drift from
  // the row persist() writes. A reader must still tolerate the key's absence
  // on legacy artifacts (scorecard reader) — never invent a class.
  entryRow.endClass = historyEndClass(entryRow, mode);
  return { entryRow, card, acceptance, noBalance };
}

/** W5-L5 T-107.5 — the run-side pass predicate for one trial: the rubric met
 *  the grader's threshold AND every declared run-side assertion held (files /
 *  content / the declared behavior rows / the declared kind). A crash/missing
 *  mean is a FAIL, never a default pass. W40·N4: the behavior and kind clauses
 *  only bite on an EXPLICIT failed verdict (`=== false`). fixes/299 (U1):
 *  `entry-runs` rows now really fail (bounded spawn — a broken artifact is
 *  `behaviorOk:false`), while a `ui-shell` structural skip is NOT a failure
 *  (and a v1 grader's acceptance object, neither key present, still invents
 *  nothing). */
export function passesAcceptance(row, acceptance, grader) {
  if (!row || typeof row.mean !== "number" || !Number.isFinite(row.mean)) return false;
  if (row.mean < grader.passWhen.meanAtLeast) return false;
  if (grader.passWhen.requireExpectedFiles && acceptance.filesOk !== true) return false;
  if (grader.passWhen.requireExpectedContent && acceptance.contentOk !== true) return false;
  if (grader.passWhen.requireExpectedBehavior && acceptance.behaviorOk === false) return false;
  if (grader.passWhen.requireExpectedKind && acceptance.kindOk === false) return false;
  return true;
}

/** 255 (W20-L2): the pass verdict above is a boolean asked of SIX clauses —
 *  a finite mean, the rubric threshold, the expectedFiles check, the
 *  expectedContent check, the declared behavior rows and the declared kind.
 *  Only some write into the record's shortfall lists, so a threshold-only
 *  failure (the run-2 shape: `acceptance.pass:false` with filesOk+contentOk
 *  true and an EMPTY shortfall list) used to be indistinguishable from a
 *  crash at a glance. This names the FIRST false clause in the SAME order and
 *  with the SAME leniency gates as passesAcceptance (kept adjacent so the two
 *  can never drift); null when the row passes. Additive: it never changes a
 *  verdict. */
export function acceptanceFailReason(row, acceptance, grader) {
  if (!row || typeof row.mean !== "number" || !Number.isFinite(row.mean)) {
    return "mean missing — the rubric never produced a number (crashed trial)";
  }
  if (row.mean < grader.passWhen.meanAtLeast) {
    return `mean ${row.mean} < ${grader.passWhen.meanAtLeast} (rubric threshold — files/content are not the cause)`;
  }
  if (grader.passWhen.requireExpectedFiles && acceptance.filesOk !== true) {
    return `expected files missing: ${acceptance.missingFiles.join(", ")}`;
  }
  if (grader.passWhen.requireExpectedContent && acceptance.contentOk !== true) {
    return `expected content missing: ${acceptance.failedContent.join("; ")}`;
  }
  if (grader.passWhen.requireExpectedBehavior && acceptance.behaviorOk === false) {
    const rows = acceptance.behavior && Array.isArray(acceptance.behavior.rows) ? acceptance.behavior.rows : [];
    const failed = rows.filter((r) => r.status === "fail");
    const named = failed
      .slice(0, 3)
      .map((r) => {
        const loc = r.path ? ` (${r.path})` : r.target ? ` (${r.target})` : r.entry ? ` (${r.entry})` : "";
        // fixes/301 (X2 — Q4-b tail): the failed row's OWN coded detail (exit
        // code / missing pin / spawn error — what evaluateEntryRunsRow saw)
        // must ride the reason; an id alone cannot be acted on. Bounded so a
        // noisy child cannot bloat the record.
        const detail =
          typeof r.detail === "string" && r.detail.trim() !== "" ? `: ${r.detail.trim().slice(0, 120)}` : "";
        return `${r.id}${loc}${detail}`;
      })
      .join("; ");
    return `expected behavior failed: ${named || "declared row(s) failed"}`;
  }
  if (grader.passWhen.requireExpectedKind && acceptance.kindOk === false) {
    return `expected kind mismatch: ${(acceptance.kind && acceptance.kind.reason) || "emitted kind does not match expectedKind"}`;
  }
  return null;
}

/**
 * F1 (314) — the per-trial ITERATE facts (SE2 §4a; additive row key). The
 * bounded iterate-until-satisfaction driver's decision is computed — by the
 * PURE `decideIterate` — against this trial's OWN card mean (the 0..1 rubric
 * scale) plus the process token budget, and recorded on every row. Two
 * honest invariants:
 *   · `wouldFire` is the decision IF a regeneration seam were attached;
 *     `seamAttached:false` and `engaged:false` are recorded explicitly — the
 *     live keyed firing is the owner-gated step (F1 PROVE's run) and this leg
 *     NEVER regenerates anything.
 *   · OFF by default: `RAPIDTOOL_ITERATE_THRESHOLD` unset ⇒ armed:false,
 *     code `iterate.disabled` — the parked owner decision, named per row.
 */
export function iterateFactsFor(card, { env = process.env, budgetExhausted = null } = {}) {
  const config = readIterateConfig(env);
  const score = card && typeof card.mean === "number" && Number.isFinite(card.mean) ? card.mean : null;
  const exhausted =
    typeof budgetExhausted === "boolean" ? budgetExhausted : isBudgetExhausted(sessionTokenBudget());
  const decision = decideIterate({ config, score, cycle: 0, budgetExhausted: exhausted, seamAttached: true });
  return {
    armed: config.enabled,
    threshold: config.threshold,
    maxCycles: config.maxCycles,
    score: score === null ? null : Number(score.toFixed(4)),
    wouldFire: decision.fire,
    code: decision.code,
    budgetExhausted: exhausted,
    seamAttached: false,
    engaged: false,
    configNotes: config.notes,
    note: config.enabled
      ? `iterate ARMED (threshold ${config.threshold}, max ${config.maxCycles} cycle(s)) — decision ${
          decision.fire ? "below-threshold → WOULD fire" : `no-fire (${decision.code})`
        }; live regeneration is owner-gated (F1 PROVE keyed run) — engaged=false, nothing fired by this leg`
      : `${ITERATE_THRESHOLD_ENV} unset — iterate driver OFF (parked owner decision); decision recorded, nothing fired`,
  };
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
    // W23-L1 (fixes/262): a no-balance trial is NOT scored. Its floor card is
    // preserved as evidence, but `pass` stays null and the trial is excluded
    // from pass@k / pass^n / flakiness below — a broke wallet never counts as
    // a measurement (run #3's 3/9 read as a score; it was an empty wallet).
    let pass = null;
    let passReason = null;
    if (r.noBalance === true) {
      passReason =
        "no-balance: the account is unfunded — this trial is NOT a measurement (capability: cannot-run-keyed (account unfunded))";
    } else {
      pass = passesAcceptance(r.entryRow, r.acceptance, grader);
      // 255 (W20-L2): name the false clause in the record AND the log — a
      // threshold-only failure must not read as an unexplained `pass=no`.
      passReason = acceptanceFailReason(r.entryRow, r.acceptance, grader);
    }
    if (passReason !== null) r.acceptance.passReason = passReason;
    r.entryRow.acceptance.pass = pass;
    if (passReason !== null) r.entryRow.acceptance.passReason = passReason;
    r.entryRow.durationSec = durationSec;
    trialRows.push(r.entryRow);
    acceptances.push({ ...r.acceptance, pass, ...(passReason !== null ? { passReason } : {}) });
    if (trial === 1) firstCard = r.card;
    const shortfalls = [
      ...r.acceptance.missingFiles.map((f) => `missing ${f}`),
      ...r.acceptance.failedContent.slice(0, 2),
    ];
    console.log(
      `     trial ${trial}/${TRIALS}: ${r.entryRow.status} · ${r.entryRow.total}/9 (mean ${r.entryRow.mean.toFixed(2)}) · pass=${pass === null ? "n/a (no-balance)" : pass ? "yes" : "no"}` +
        (shortfalls.length > 0 ? ` · acceptance: ${shortfalls.slice(0, 3).join("; ")}` : "") +
        (passReason !== null ? ` · why: ${passReason}` : "") +
        ` · ${durationSec}s`,
    );
  }
  // W23-L1 (fixes/262): only SCORED trials enter the outcomes vector; an
  // unfunded trial is counted separately and can never buy a pass or a fail.
  const scoredTrialRows = trialRows.filter((row) => row.acceptance.pass !== null);
  const noBalanceTrials = trialRows.length - scoredTrialRows.length;
  const outcomes = scoredTrialRows.map((row) => row.acceptance.pass === true);
  const trialsBlock = trialsSummary(outcomes, { k: K });
  if (noBalanceTrials > 0) {
    trialsBlock.noBalanceTrials = noBalanceTrials;
    trialsBlock.note =
      `${noBalanceTrials}/${TRIALS} trial(s) ended no-balance (account unfunded) — excluded from pass@1/pass@k/flakiness (NOT measurements)` +
      (trialsBlock.note ? `; ${trialsBlock.note}` : "");
    console.log("");
    console.log(`!!!!! NO-BALANCE — ${entry.slug}: ${noBalanceTrials}/${TRIALS} trial(s) could not run keyed (account unfunded)`);
    console.log("      those trials are excluded from every score; top up the account and re-run before reading any number");
    console.log("");
  }
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
      // W23-L1 (fixes/262): null = NOT scored (no-balance trial) — distinct
      // from a measured `false`; `scored` names it explicitly.
      pass: r.acceptance.pass === null ? null : r.acceptance.pass === true,
      scored: r.acceptance.pass !== null,
      noBalance: Boolean(r.notes && r.notes.noBalance === true),
      emitDir: r.emitDir,
      durationSec: r.durationSec,
      graderLeak: r.graderLeak.leaked === true,
      // W23-L1: the trial's measured model evidence rides the per-trial block.
      servedModels: r.servedModels ?? [],
      usage: r.usage ?? null,
      estimatedCostUsd: r.estimatedCostUsd ?? null,
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
  // W23-L1 (fixes/262): the `trials > 0` guard — a case whose EVERY trial
  // ended no-balance (0 scored trials, 0 passes) must never satisfy
  // `passes === trials` and read as "passed". Unfunded cases are also named
  // in their own summary list, whose key appears ONLY when non-empty (the
  // keyless key-set contract for buildSummary holds — W16-L1's pin).
  const passed = rows
    .filter((r) => r.entryRow.trials && r.entryRow.trials.trials > 0 && r.entryRow.trials.passes === r.entryRow.trials.trials)
    .map((r) => r.entryRow.slug);
  const unfunded = rows
    .filter((r) => r.entryRow.trials && r.entryRow.trials.trials === 0)
    .map((r) => r.entryRow.slug);
  const withTrials = rows.filter((r) => r.entryRow.trials && typeof r.entryRow.trials.passAt1 === "number");
  const meanPassAt1 = withTrials.length ? round4(withTrials.reduce((a, r) => a + r.entryRow.trials.passAt1, 0) / withTrials.length) : 0;
  return {
    trials,
    cases,
    passAtK: { k: trials, cases, passed: passed.length, passedSlugs: passed, meanPassAt1 },
    flakyCases: flaky,
    graderLeaks: leaked,
    ...(unfunded.length > 0
      ? { noBalanceCases: unfunded, noBalanceNote: "these cases recorded 0 scored trials — the account was unfunded; they are not passes and not failures" }
      : {}),
    skipped: skips.length,
    skips,
  };
}

/** W40·N4 (L3 item): the END CLASS of one recorded trial, on the
 *  funded | unfunded | unmeasured axis the campaign reads history by:
 *    "funded"     — a SCORED trial (pass true|false) in a KEYED run: the
 *                   account could pay, the model ran, the verdict is a real
 *                   measurement;
 *    "unfunded"   — a no-balance trial: the wallet refused; never a
 *                   measurement (excluded from every score);
 *    "unmeasured" — every other ending: a keyless trial (the deterministic
 *                   floor — real data, but NO WALLET was involved, so it is
 *                   deliberately NOT classed funded), a crashed/skipped
 *                   trial, or a row that never reached a verdict.
 *  Exported so history.json's recorder and the CLI scorecard's reader name
 *  the same classes — one definition, no drift. */
export function historyEndClass(row, mode) {
  if (row && row.notes && row.notes.noBalance === true) return "unfunded";
  const pass = row && row.acceptance ? row.acceptance.pass : undefined;
  if ((pass === true || pass === false) && mode === "keyed") return "funded";
  return "unmeasured";
}

/** W42·L1-E6(b): the history.json trend is append-only, and the scorecard's M7
 *  prior + trends read it WHOLE — unbounded growth makes every read O(all runs
 *  ever). Keep the newest N rows (200 ≈ years of daily full-corpus runs); older
 *  rows are dropped from the FILE only, never invented back. Exported so the
 *  bound is pinnable (run-eval.test.mjs) without driving the slow pipeline. */
export const MAX_HISTORY_ROWS = 200;

/** W42·L1-E6(a): write `value` as pretty JSON onto `target` ATOMICALLY —
 *  same-dir temp + rename, styled after writeMarkerAtomic below. A plain
 *  writeFileSync truncates the target before it writes, so a kill mid-write
 *  leaves a torn/0-byte results.json or history.json — and the stale-read
 *  class this repo already bit on (W16-L1) reads such a tear as "the previous
 *  run" or as garbage. rename(2) is atomic within one filesystem: a reader
 *  sees the previous bytes or the new ones, never a tear. The serialized
 *  bytes are byte-identical to the previous direct write (same
 *  JSON.stringify(value, null, 2), no trailing newline — the scorecard and the
 *  gate consume these files, formats must not move). Exported for the unit
 *  seam: run-eval.test.mjs drives the failed-rename path (rename(2) onto an
 *  existing directory → EPERM on this host) against a real target. */
export function writeJsonAtomic(target, value) {
  mkdirSync(dirname(target), { recursive: true });
  const tmp = `${target}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
  renameSync(tmp, target);
}

function persist(rows, mode, skips = [], extra = {}) {
  mkdirSync(OUT_DIR, { recursive: true });
  const results = {
    generatedAt: new Date().toISOString(),
    mode,
    corpusDir: CORPUS_DIR,
    // W5-L5 additive: where the run-side acceptance bars came from.
    graderDir: GRADER_DIR,
    // OV-7 additive: the grader-freeze verdict for this run — { checked, ok,
    // changed }; a moved grader invalidates the scores it graded.
    ...(extra.graderFreeze ? { graderFreeze: extra.graderFreeze } : {}),
    entries: rows.map((r) => r.entryRow),
    summary: {
      entries: rows.length,
      meanTotal: rows.length ? rows.reduce((a, r) => a + r.entryRow.mean, 0) / rows.length : 0,
      ...buildSummary(rows, skips),
    },
  };
  // W42·L1-E6(a): atomic (same-dir tmp + rename) — a kill mid-write can no
  // longer tear results.json; the reader sees the previous run or this one.
  writeJsonAtomic(RESULTS_PATH, results);

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
        // W40·N4 (L3 item): tri-state pass — null means NOT scored (an
        // unfunded trial is not a failure); a boolean is a real verdict.
        pass: t.acceptance && typeof t.acceptance.pass === "boolean" ? t.acceptance.pass : null,
        // W40·N4 (L3 item): the funded | unfunded | unmeasured end class —
        // see historyEndClass; history rows are only as readable as this axis.
        endClass: historyEndClass(t, mode),
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
  // W42·L1-E6(b): bound the append-only trend — keep the newest
  // MAX_HISTORY_ROWS rows (this run's included) before the atomic write.
  writeJsonAtomic(HISTORY_PATH, history.slice(-MAX_HISTORY_ROWS));
  return results;
}

// ---------------------------------------------------------------------------
// OV-35(c) — kill-safety run marker (WB-6, fixes/244 W16-L1). results.json is
// written once at the END of a run (persist, above) and history.json after it;
// a kill anywhere leaves the PREVIOUS run's results.json on disk — the stale
// 2026-09-17 keyless 6/9 that can be misread as the new result. The marker is
// written BEFORE the first corpus entry of a KEYED run and finalized only after
// BOTH persists return; `finishedAt:null` therefore means "this run did not
// complete — do not read results.json as its result". Keyed-only: the keyless
// leg writes nothing new (byte-identity contract).
// ---------------------------------------------------------------------------

export const RUN_MARKER_NAME = "run-in-progress.json";

export function markerPathFor(outDir) {
  return join(outDir, RUN_MARKER_NAME);
}

/** Write `marker` onto the marker path ATOMICALLY (same-dir temp + rename).
 *  A plain writeFileSync truncates the target before it writes, so a kill
 *  between the open and the write leaves a 0-byte (or partial) file — and
 *  `runMarkerState` reads an unparseable marker as `none`, i.e. "no run ever",
 *  silently dropping the killed-run warning this marker exists to carry
 *  (W16-L1 / WB-6: the stale results.json then reads as current again).
 *  rename(2) is atomic within one filesystem: a reader sees the previous
 *  bytes or the new ones, never a tear. */
function writeMarkerAtomic(outDir, marker) {
  mkdirSync(outDir, { recursive: true });
  const target = markerPathFor(outDir);
  const tmp = `${target}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(marker, null, 2)}\n`, "utf8");
  renameSync(tmp, target);
}

/** Write the run-start marker (overwrites any previous one). */
export function writeRunStartMarker(outDir, info = {}) {
  const marker = {
    markerVersion: 1,
    mode: info.mode ?? "keyed",
    startedAt: info.startedAt ?? new Date().toISOString(),
    finishedAt: null,
    done: false,
    entries: typeof info.entries === "number" ? info.entries : null,
    corpus: info.corpus ?? null,
    preflightClass: info.preflightClass ?? null,
    pid: process.pid,
  };
  writeMarkerAtomic(outDir, marker);
  return marker;
}

/** Read the marker. Unreadable/absent → null (never throws). */
export function readRunMarker(outDir) {
  try {
    const raw = readFileSync(markerPathFor(outDir), "utf8");
    const doc = JSON.parse(raw);
    return doc && typeof doc === "object" && !Array.isArray(doc) ? doc : null;
  } catch {
    return null;
  }
}

/** Finalize the marker AFTER both persists: finishedAt set, done true. */
export function finishRunMarker(outDir, patch = {}) {
  const prev = readRunMarker(outDir) ?? { markerVersion: 1, mode: "keyed", startedAt: null };
  const marker = { ...prev, ...patch, finishedAt: new Date().toISOString(), done: true };
  writeMarkerAtomic(outDir, marker);
  return marker;
}

/** The torn-pair read (WB-6): `unfinished` means a run started and was never
 *  finalized — the results.json on disk may be the PREVIOUS run's and must not
 *  be read as this one's. A marker file that EXISTS but cannot be read/parsed is
 *  `unfinished` too — fail-SAFE, never fail-open: a kill between writeFileSync's
 *  truncating open and its write left exactly that shape (the atomic write above
 *  makes a tear impossible now), and reading it as `none` ("no run ever")
 *  silently dropped the killed-run warning the marker exists to carry. */
export function runMarkerState(outDir) {
  const marker = readRunMarker(outDir);
  if (!marker) {
    let present = false;
    try {
      present = existsSync(markerPathFor(outDir));
    } catch {
      present = false;
    }
    if (!present) return { state: "none", marker: null, note: null };
    return {
      state: "unfinished",
      marker: null,
      note: `${RUN_MARKER_NAME} is present but unreadable / not valid JSON — treat it as a run that started and was never finalized (a kill can leave a torn marker file); any results.json present predates or is torn relative to it and must not be read as this run's result`,
    };
  }
  if (marker.done !== true || !marker.finishedAt) {
    return {
      state: "unfinished",
      marker,
      note: `a run started ${marker.startedAt ?? "(unknown)"} was never finalized (finishedAt:null) — it was killed mid-run; any results.json present predates or is torn relative to it and must not be read as this run's result`,
    };
  }
  return { state: "finished", marker, note: null };
}

/** Run the entry loop under the marker: the marker is written BEFORE the first
 *  entry runs (ordering is the pin) and left unfinished — main() finalizes it
 *  only after BOTH persists return. Keyless: a no-op wrapper that writes
 *  nothing. `runner` is injectable so the ordering is testable durably.
 *  @param {any[]} selected
 *  @param {{mode?: string, outDir?: string, runner?: (target: any) => any, markerExtra?: Record<string, any>}} [options] */
export async function runWithMarker(selected, { mode, outDir, runner, markerExtra = {} } = {}) {
  let markerPath = null;
  let previousUnfinished = null;
  if (mode === "keyed") {
    const prev = runMarkerState(outDir);
    if (prev.state === "unfinished") {
      previousUnfinished = prev.marker;
      console.log(
        `note: an earlier keyed run marker (started ${prev.marker?.startedAt ?? "(marker unreadable)"}) was NEVER finalized — that run was killed; its results.json must not be read as a completed result`,
      );
    }
    writeRunStartMarker(outDir, { mode, entries: selected.length, ...markerExtra });
    markerPath = markerPathFor(outDir);
    console.log(
      `marker: keyed run-start recorded at ${markerPath} (stays finishedAt:null until results.json AND history.json are written)`,
    );
  }
  const rows = [];
  for (const target of selected) {
    rows.push(await runner(target));
  }
  return { rows, markerPath, previousUnfinished };
}

/** OV-35 — the ≤4/9 decision rule (227 §2a item 3; 223's pre-mortem predicts
 *  3–6/9 centred 4–5). A ≤4/9 keyed result is inside the predicted band: the
 *  branch is RE-TRACE (read the log, close the observed zeros) — a blind re-run
 *  re-measures the same tree and buys nothing. Keyed-only; keyless stays
 *  silent (byte-identity).
 *  @param {{mode?: string, meanOfNine?: number}} [options] */
export function keyedRunDecision({ mode, meanOfNine } = {}) {
  if (mode !== "keyed") return { branch: "n/a", line: null };
  if (typeof meanOfNine !== "number" || !Number.isFinite(meanOfNine))
    return { branch: "no-score", line: "no finite score to route — read the run log directly" };
  const of9 = Math.round(meanOfNine * 100) / 100;
  if (of9 <= 4)
    return {
      branch: "retrace-first",
      line: `${of9}/9 ≤ 4 — inside 223's predicted 3–6 band: RE-TRACE the run log and close the zeros it names (OV-3/OV-4/OV-5 gate on the log) — do NOT re-run blind hoping for a better number; a re-run re-measures the same tree.`,
    };
  if (of9 <= 6)
    return {
      branch: "band-expected",
      line: `${of9}/9 — within the pre-mortem's predicted 3–6 band: read the log, fix the named zeros, then run #2.`,
    };
  return {
    branch: "above-prediction",
    line: `${of9}/9 — above the predicted band: still read the log for the zeros before publishing any claim.`,
  };
}

// ---------------------------------------------------------------------------
// Main — results are data: exit 0 always.
// ---------------------------------------------------------------------------

async function main() {
  // OV-35(a) — standalone probe mode: run the reachability probe and exit (no
  // corpus walk, no entries). Works keyless (dummy key) and keyed.
  if (process.argv.includes("--preflight")) {
    console.log(`rapidtool eval · preflight probe (OV-27) · ${new Date().toISOString()}`);
    const probe = await probeP6Reachability({});
    for (const line of formatPreflightLines(probe)) console.log(line);
    console.log("exit 0 — the probe reports; a failed probe is data, not a crash");
    process.exit(0);
  }
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
    emitEvalRunRow({
      level: "info",
      scope: "eval-run",
      event: "eval.run_end",
      message: `eval run end (empty corpus) · mode=${mode} · 0 entries`,
      capture: "run-eval.mjs:2950",
      payload: { mode, entries: 0, empty: true },
    });

    mkdirSync(OUT_DIR, { recursive: true });
    // W44 A5 (bug-hunter · scripts box): this path used a bare writeFileSync
    // while writeJsonAtomic's own doc-block claims "no bare writeFileSync of
    // results/history remains" — a kill between the truncating open and the
    // write tears results.json (the stale-read class this repo already bit
    // on: a tear reads as "the previous run"). Same atomic discipline as
    // persist(); `corpusDir` joins the shape for parity with persist()'s
    // legacy contract (the scorecard reader reads it).
    writeJsonAtomic(RESULTS_PATH, {
      generatedAt: new Date().toISOString(),
      mode,
      corpusDir: CORPUS_DIR,
      graderDir: GRADER_DIR,
      entries: [],
      summary: { entries: 0, meanTotal: 0, ...buildSummary([], skipped) },
    });
    process.exit(0);
  }

  // W5-L5 T-107.5 — the RUN-SIDE grader decides what is gradeable. A case with
  // no valid grader file is SKIPPED with a reason (recorded in the summary),
  // never scored against an undeclared bar.
  const plan = planTargets(entries, (slug) => loadGrader(slug));
  const skips = [...skipped, ...plan.skips];
  for (const s of plan.skips) console.log(`skip ${s.slug}: ${s.reason}`);
  const targets = plan.targets;

  // OV-7 grader freeze: fingerprint every run-side grader BEFORE the first
  // entry runs (same ordering discipline as the keyed run marker) and re-verify
  // before persist below — a bar that moved mid-run cannot grade that run.
  const graderFreezeAtStart = targets.map((t) => ({
    slug: t.entry.slug,
    ...graderFreezeFingerprint(t.graderPath),
  }));

  // Keyed default: ONE entry (cost guard). `--all` or `--limit=N` lifts it.
  const cap = EVAL_ALL ? targets.length : Number.isFinite(EVAL_LIMIT) && EVAL_LIMIT > 0 ? EVAL_LIMIT : mode === "keyed" ? 1 : targets.length;
  const selected = targets.slice(0, cap);
  if (mode === "keyed" && selected.length < targets.length) {
    console.log(`note: keyed leg bounded to ${selected.length} corpus entry (${selected[0].entry.slug}); pass --all or --limit=N for more; budget per P6 journey = ${JOURNEY_BUDGET} cycle(s)`);
  }

  emitEvalRunRow({
    level: "info",
    scope: "eval-run",
    event: "eval.run_start",
    message: `eval run start · mode=${mode} · ${selected.length} target(s) of ${targets.length} · trials=${TRIALS}`,
    capture: "run-eval.mjs:3001",
    payload: { mode, targets: selected.length, trials: TRIALS },
  });

  // OV-35(a) — the keyed preflight runs BEFORE any entry: a bad key must be a
  // class, not a quality reading (227 §2a). Keyless legs never probe (no
  // network, byte-identical).
  let preflight = null;
  if (KEYED_OK) {
    preflight = await probeP6Reachability({});
    for (const line of formatPreflightLines(preflight)) console.log(line);
    if (!preflight.ok) {
      console.log(
        `PREFLIGHT NOT READY: class=${preflight.class} (${preflight.code ?? "no code"}) — entries below would refuse per call; their scores are NOT a quality signal. Fix the class first.`,
      );
    }
  }

  // W23-L1 — the FUNDEDNESS wire (the run-#3 lesson): after reachability, ask
  // the one question a 401-class probe cannot answer — does the account have
  // balance? `funded:false` (HTTP 402 / the vendor's no-balance class) must
  // stop the scored trials: a broke wallet is not a measurement (run #3's
  // 3/9 @ 2.6s was an unfunded account, not a regression). `funded:null`
  // (unaskable: auth/network/timeout) is REPORTED and proceeds — never
  // guessed into a pass or a fail. The key VALUE never enters the output.
  let fundedness = null;
  if (KEYED_OK) {
    fundedness = await probeFundedness({});
    // W24/B2 (fixes/263): the ONE renderer (`formatFundednessLines`) — the
    // old inline copy had already drifted from it and the helper was a dead
    // export.
    for (const line of formatFundednessLines(fundedness)) console.log(line);
    if (fundedness.funded === false) {
      console.log(
        `FUNDEDNESS STOP: the account is UNFUNDED (${fundedness.code ?? "no-balance"}) — a scored trial would measure the wallet, not the product. Top up, then re-run. No trial runs; results will record the skip.`,
      );
      // The existing downstream path records "nothing gradeable" with reasons —
      // reuse it rather than duplicating the results writer here. W24/B2
      // (fixes/263): that path only records the reasons it is HANDED, so this
      // stop must record its own skip row — without it the empty results.json
      // carried NO reason (the line above claims "results will record the
      // skip"; it did not).
      skips.push({
        slug: null,
        kind: "account-unfunded",
        reason: `fundedness probe stopped the run: the account cannot pay (${fundedness.code ?? "no-balance"}) — no scored trial ran; top up and re-run (this is a wallet skip, not a measurement)`,
      });
      selected.length = 0;
    }
  }

  const rows = [];
  if (selected.length === 0) {
    console.log("note: nothing gradeable — every corpus entry was skipped above (results recorded with the skip reasons, exit 0)");
  }
  // W24/B2 (fixes/263) — THE TAP MUST BE INSTALLED. The W23-L1 per-trial model
  // evidence (servedModels / usage / estimatedCostUsd) is fed by the provider's
  // opt-in call tap through `beginTrialCallTap`/`endTrialCallTap` — but nothing
  // ever called `installLlmCallTap` (the install has no other call site), so
  // every keyed trial folded an EMPTY record list and recorded `usage:{0,0,0}`
  // + `estimatedCostUsd:0` + "nothing billed": fabricated zeros, exactly what
  // `llmEvidenceFromCallRecords`'s own contract forbids. Installed once per
  // process, before any scored trial can make a keyed call.
  let tapInstalled = false;
  if (KEYED_OK) {
    tapInstalled = await installLlmCallTap();
    console.log(
      tapInstalled
        ? "preflight: provider call tap installed — per-trial served-model/usage/cost evidence will be recorded"
        : "preflight: provider call tap UNAVAILABLE on this host — per-trial model evidence will record nulls (never zeros)",
    );
  }
  const runner = async ({ entry, grader, graderPath }) => {
    try {
      const t0 = Date.now();
      const { entryRow, card, trialRows } = await evaluateEntry(entry, mode, grader, graderPath);
      const tb = entryRow.trials;
      console.log(
        `ok   ${entry.slug}: ${entryRow.status} · ${entryRow.total}/9 (mean ${entryRow.mean.toFixed(2)}) · ${tb.trials} trial(s) · pass@${tb.kEffective}=${tb.passAtK}${tb.flaky ? " · FLAKY" : ""} · ${((Date.now() - t0) / 1000).toFixed(1)}s`,
      );
      // OV-35(b): a non-complete ending is never silent — its code is printed
      // where the row is printed (complete rows stay byte-identical).
      if (entryRow.status !== "complete" && entryRow.notes && entryRow.notes.stopCode) {
        console.log(
          `     ending: ${entryRow.status} · code ${entryRow.notes.stopCode} — classified (see notes.stall in the row)`,
        );
      }
      return { entryRow, card, trialRows };
    } catch (e) {
      // An entry that blows up is recorded as data, never a process failure.
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`fail ${entry.slug}: ${msg.slice(0, 300)}`);
      return {
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
          // W42·L1-E1: a crashed/skipped trial never reached a verdict — by
          // the classifier's own doc (historyEndClass) it is "unmeasured",
          // never fabricated into funded/unfunded.
          endClass: "unmeasured",
        },
        card: null,
        trialRows: [],
      };
    }
  };
  // OV-35(c) — the keyed run marker is written BEFORE the first corpus entry
  // and left unfinished until both persists below return (WB-6).
  const ran = await runWithMarker(selected, {
    mode,
    outDir: OUT_DIR,
    runner,
    markerExtra: { corpus: CORPUS_DIR, preflightClass: preflight ? preflight.class : null },
  });
  rows.push(...ran.rows);

  // OV-7 grader freeze verification: the bar must not have moved while the run
  // was in flight. Each row is stamped with the fingerprint its grader carried
  // at run start + the run-level verdict; a moved grader is printed LOUDLY and
  // recorded (results.json.graderFreeze) — the affected scores are invalid.
  const graderFreeze = verifyGraderFreeze(graderFreezeAtStart);
  const startFpBySlug = new Map(graderFreezeAtStart.map((f) => [f.slug, f]));
  for (const r of ran.rows) {
    const fp = startFpBySlug.get(r.entryRow.slug);
    if (fp && r.entryRow.grader && typeof r.entryRow.grader === "object") {
      r.entryRow.grader.fileHashAtStart = fp.hash;
      r.entryRow.grader.fileFrozen = graderFreeze.ok;
    }
  }
  if (!graderFreeze.ok) {
    console.log("");
    console.log("!!!!! GRADER MOVED MID-RUN — the acceptance bar changed while the run was in flight:");
    for (const c of graderFreeze.changed) {
      console.log(`      ${c.slug ?? c.path}: ${c.reason} (hash ${c.hashAtStart ?? "?"} -> ${c.hashNow ?? "unreadable"})`);
    }
    console.log("      the scores recorded for the affected cases are INVALID — re-run against a frozen grader");
    console.log("");
  }

  console.log("");
  printTable(rows);
  printTrialsSummary(rows);
  const results = persist(rows, mode, skips, { graderFreeze });
  if (mode === "keyed") {
    // OV-35 — the ≤4/9 decision rule: the score is routed to a named branch
    // (re-trace vs band-expected vs above) instead of a bare number.
    const decision = keyedRunDecision({ mode, meanOfNine: results.summary.meanTotal * 9 });
    if (decision.line) console.log(`decision: ${decision.line}`);
    finishRunMarker(OUT_DIR, {
      entries: rows.length,
      meanOfNine: Number((results.summary.meanTotal * 9).toFixed(4)),
      decision: decision.branch,
      preflightClass: preflight ? preflight.class : null,
      // W40·N4 (L3 item — finalize-after-persist): this call site is reached
      // ONLY after persist() returned (results.json, then history.json were
      // written in that order). The two flags are read from the filesystem at
      // finalize time, never hardcoded: if a file were absent here, the marker
      // would say so instead of claiming a write that never happened.
      resultsWritten: existsSync(RESULTS_PATH),
      historyWritten: existsSync(HISTORY_PATH),
    });
    console.log(
      "marker: keyed run finalized (finishedAt set) — results.json AND history.json are both written; a killed run would have left finishedAt:null",
    );
  }
  emitEvalRunRow({
    level: "info",
    scope: "eval-run",
    event: "eval.run_end",
    message: `eval run end · mode=${mode} · ${rows.length} entr${rows.length === 1 ? "y" : "ies"} · meanOfNine=${Number((results.summary.meanTotal * 9).toFixed(4))} · skips=${skips.length}`,
    capture: "run-eval.mjs:3186",
    payload: {
      mode,
      entries: rows.length,
      meanOfNine: Number((results.summary.meanTotal * 9).toFixed(4)),
      skips: skips.length,
    },
  });
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
      // W44 A5 (bug-hunter · scripts box): the crash tombstone must be atomic
      // too — a plain writeFileSync can leave a 0-byte/partial results.json
      // (kill mid-write) that readers then misread as "the previous run".
      writeJsonAtomic(RESULTS_PATH, {
        generatedAt: new Date().toISOString(),
        mode: KEYED_OK ? "keyed" : "keyless",
        entries: [],
        error: e instanceof Error ? e.message : String(e),
      });
    } catch {
      /* nowhere to write */
    }
    emitEvalRunRow({
      level: "error",
      scope: "eval-run",
      event: "eval.run_error",
      message: `eval driver crashed · ${e instanceof Error ? e.message : String(e)}`,
      capture: "run-eval.mjs:3225",
      payload: { mode: KEYED_OK ? "keyed" : "keyless" },
    });
    console.error(`eval driver crashed: ${e instanceof Error ? e.stack : String(e)}`);
    process.exit(0);
  });
}
