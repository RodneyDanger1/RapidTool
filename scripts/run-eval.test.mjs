import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  acceptanceFailReason,
  beginTrialCallTap,
  briefLeakScan,
  buildSummary,
  checkAcceptance,
  checkExpectedBehavior,
  choose,
  classifyDrainEnding,
  classifyLlmPreflight,
  classifyRunOutcome,
  corpusDomainIndex,
  drainPipeline,
  emitEvalRunRow,
  endTrialCallTap,
  finishRunMarker,
  formatFundednessLines,
  formatPreflightLines,
  graderFileFor,
  graderFreezeFingerprint,
  graderLeakScan,
  historyEndClass,
  installLlmCallTap,
  isTerminalDrainOutcome,
  keyedRunDecision,
  keylessSkipNotices,
  listCorpusEntries,
  llmCallTapIsInstalled,
  llmEvidenceFromCallRecords,
  loadGrader,
  markerPathFor,
  MAX_HISTORY_ROWS,
  parseGrader,
  passAtK,
  passCaretK,
  passesAcceptance,
  planTargets,
  priorFor,
  probeFundedness,
  probeP6Reachability,
  readRunMarker,
  RUN_MARKER_NAME,
  RUN_OUTCOME_CLASSES,
  runMarkerState,
  runWithMarker,
  scoringCorpusFor,
  trialEmitDir,
  treeTextFiles,
  treeRunToEvidence,
  trialsSummary,
  verifyGraderFreeze,
  writeJsonAtomic,
  writeRunStartMarker,
} from "./run-eval.mjs";
import { createProject, runUntilGate } from "../src/lib/headless.ts";
import { ERROR_CODE_DOC } from "../src/lib/errors.ts";
import { isKnownRtEvent } from "../src/lib/rt-events.ts";
import { projectRoot } from "./with-app-env.mjs";

/**
 * W5-L5 / T-107.5 (`wave_plans/W5/lane-5.md`) — pins for the run-side grader
 * layer + trials/pass@k accounting of the maker-loop eval driver.
 *
 * Three claims, each provable WITHOUT running the (slow) eval pipeline:
 *   (a) GRADER INVISIBILITY — every corpus case's acceptance bar lives in a
 *       run-side grader file that is outside every emit path, the driver grades
 *       from it (never from the frontmatter copy), and no emitted tree on disk
 *       contains or references it (leak scan, with a planted-leak control so
 *       the scan itself is falsifiable).
 *   (b) pass@k MATH — the human-eval estimator + pass^k + the flakiness
 *       classification, on synthetic outcomes, including the edge cases
 *       (k > n, 1 trial = flakiness unmeasurable, strict `true` counting).
 *   (c) HONEST KEYLESS SKIPS — a keyless run says what it does NOT do, a
 *       `--keyed` request without the key degrades with a reason, no key
 *       material can reach the notices, and a case without a run-side grader
 *       is SKIPPED (recorded) instead of scored against an undeclared bar.
 *
 * The driver is imported, not spawned: run-eval.mjs only self-executes as the
 * main module, so these tests can never trigger a real eval run.
 */

const ROOT = projectRoot();
const CORPUS_DIR = join(ROOT, "research", "eval-corpus");
const GRADER_DIR = join(CORPUS_DIR, "graders");
const OUT_DIR = join(ROOT, "research", "eval-out");

/** Corpus case slugs (frontmatter-carrying fixtures; README is documentation). */
function corpusSlugs() {
  return readdirSync(CORPUS_DIR, "utf8")
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .map((f) => f.slice(0, -3))
    .sort();
}

/** `child` at or under `parent` (both absolute; case-insensitive on Windows). */
function inside(parent, child) {
  const p = parent.replace(/\\/g, "/").toLowerCase().replace(/\/+$/, "");
  const c = child.replace(/\\/g, "/").toLowerCase();
  return c === p || c.startsWith(`${p}/`);
}

function tempDir(tag) {
  return mkdtempSync(join(tmpdir(), `run-eval-${tag}-`));
}

// ---------------------------------------------------------------------------
// (a) GRADER INVISIBILITY
// ---------------------------------------------------------------------------

test("(a) every corpus case carries a run-side grader outside every emit path", () => {
  const slugs = corpusSlugs();
  assert.ok(slugs.length >= 6, `expected the six corpus cases, saw ${slugs.length}`);
  for (const slug of slugs) {
    const g = loadGrader(slug);
    assert.equal(g.ok, true, `${slug}: ${g.ok ? "" : g.error}`);
    assert.equal(g.grader.slug, slug);
    assert.ok(g.grader.acceptanceBar.length > 0, `${slug}: grader must declare an acceptance bar`);
    assert.ok(g.grader.requiredCapabilities.length > 0, `${slug}: grader must demand capabilities`);
    // The grader is a run-side file, never inside an emitted tree:
    assert.equal(inside(OUT_DIR, g.path), false, `${slug}: grader must not live under the emit root`);
    for (const [trial, trials] of [[1, 1], [2, 3], [1, 4]]) {
      const emitDir = trialEmitDir(OUT_DIR, slug, trial, trials);
      assert.equal(inside(emitDir, g.path), false, `${slug}: grader inside trial emit dir`);
      assert.equal(inside(g.path, emitDir), false, `${slug}: emit dir inside the grader path`);
    }
  }
});

test("(a) graderLeakScan flags planted grader content and clears a clean tree", () => {
  const g = loadGrader("coffeehouse2home-property-ledger");
  assert.equal(g.ok, true);
  const grader = g.grader;

  const dir = tempDir("leak");
  try {
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "clean", scripts: { test: "node --test" } }), "utf8");
    writeFileSync(join(dir, "src", "index.ts"), "export const propertyLedger = 1;\n", "utf8");
    const clean = graderLeakScan(dir, grader);
    assert.equal(clean.leaked, false, "clean tree must not be flagged");
    assert.equal(clean.hits.length, 0);
    assert.ok(clean.scanned >= 2, `expected the tree files to be scanned, saw ${clean.scanned}`);
    // Coverage of the tree walk is real (not an empty-scan false negative):
    const walked = treeTextFiles(dir);
    assert.ok(walked.includes("package.json") && walked.some((f) => f.endsWith("src/index.ts")));

    // Planted leak 1: the acceptance bar, verbatim, in a tree file.
    writeFileSync(join(dir, "src", "index.ts"), `// ${grader.acceptanceBar}\n`, "utf8");
    const leaked = graderLeakScan(dir, grader);
    assert.equal(leaked.leaked, true, "planted acceptance bar must be flagged");
    assert.ok(
      leaked.hits.some((h) => h.marker === "acceptanceBar" && h.file.endsWith("src/index.ts")),
      `expected an acceptanceBar hit, saw ${JSON.stringify(leaked.hits)}`,
    );

    // Planted leak 2: a reference to the grader file itself.
    writeFileSync(join(dir, "src", "index.ts"), "export const g = 'eval-corpus/graders/coffeehouse2home-property-ledger.grader.json';\n", "utf8");
    const refLeak = graderLeakScan(dir, grader);
    assert.equal(refLeak.leaked, true, "a grader path reference must be flagged");
    assert.ok(refLeak.hits.some((h) => h.marker === "graderPath" || h.marker === "graderFile"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("F4 (314): treeRunToEvidence carries the verdict hash — and never invents one", () => {
  const hashed = treeRunToEvidence({
    ok: true,
    dir: "/tmp/x",
    compile: { ok: true },
    tests: [
      { file: "tests/oracle.spec.ts", run: "pass", tests: { pass: 3, fail: 0 } },
      { file: "tests/other.spec.ts", run: "pass", tests: { pass: 1, fail: 0 } },
    ],
    verdictHash: "deadbeefcafef00d",
  });
  assert.equal(hashed.ok, true);
  assert.equal(hashed.testsPass, 4);
  assert.equal(hashed.verdictHash, "deadbeefcafef00d");
  // Legacy/no-hash evidence stays legacy-shaped — the key is omitted, never guessed.
  const legacy = treeRunToEvidence({ ok: true, dir: "d", tests: [] });
  assert.equal(legacy.verdictHash, undefined);
  // Empty-string hash is not a hash.
  assert.equal(treeRunToEvidence({ ok: true, tests: [], verdictHash: "" }).verdictHash, undefined);
  assert.equal(treeRunToEvidence(null), null);
});

test("(a) emitted trees on disk carry no grader content (leak scan over the real artifacts)", (t) => {
  const slugs = corpusSlugs();
  const present = slugs.filter((slug) => existsSync(join(OUT_DIR, slug)));
  if (present.length === 0) {
    t.skip("no emitted trees under research/eval-out yet — run `npm run eval` first");
    return;
  }
  for (const slug of present) {
    const g = loadGrader(slug);
    assert.equal(g.ok, true, `${slug}: ${g.ok ? "" : g.error}`);
    const scan = graderLeakScan(join(OUT_DIR, slug), g.grader);
    assert.equal(
      scan.leaked,
      false,
      `${slug}: emitted tree carries grader content: ${JSON.stringify(scan.hits)}`,
    );
    assert.ok(scan.scanned > 0, `${slug}: emitted tree must have been scanned`);
    // The client-facing project JSON must not gain a grader field either.
    const projPath = join(OUT_DIR, slug, ".rapidtool", "project.json");
    if (existsSync(projPath)) {
      const doc = JSON.parse(readFileSync(projPath, "utf8"));
      assert.equal("grader" in doc, false, `${slug}: project.json must not carry a grader field`);
      assert.equal("acceptanceGrader" in doc, false);
    }
  }
});

test("(a) scoring reads the run-side grader, never the corpus frontmatter copy", () => {
  const parsed = parseGrader(
    JSON.stringify({
      graderVersion: 1,
      slug: "synthetic",
      acceptanceBar: "one runnable app end to end",
      requiredIdentifiers: ["graderNoun"],
      requiredCapabilities: ["graderCapability"],
    }),
    "synthetic",
  );
  assert.equal(parsed.ok, true);
  const entry = {
    slug: "synthetic",
    kind: "webapp",
    brief: "brief text",
    expectedNouns: ["frontmatterNoun"],
    expectedCapabilities: ["frontmatterCapability"],
  };
  const corpus = scoringCorpusFor(entry, parsed.grader);
  assert.deepEqual(corpus.expectedNouns, ["graderNoun"]);
  assert.deepEqual(corpus.expectedCapabilities, ["graderCapability"]);
  assert.equal(corpus.expectedNouns.includes("frontmatterNoun"), false, "frontmatter identifiers must not grade");
  assert.equal(corpus.expectedCapabilities.includes("frontmatterCapability"), false, "frontmatter capabilities must not grade");
  assert.equal(corpus.kind, "webapp");
  assert.equal(corpus.brief, "brief text");
});

test("(a) a grader that cannot be trusted never grades (parse guards)", () => {
  const base = { slug: "s", acceptanceBar: "bar text", requiredIdentifiers: [], requiredCapabilities: [] };
  assert.equal(parseGrader("not json", "s").ok, false);
  assert.equal(parseGrader(JSON.stringify({ ...base, acceptanceBar: "" }), "s").ok, false);
  assert.equal(parseGrader(JSON.stringify({ ...base, requiredIdentifiers: "nope" }), "s").ok, false);
  assert.equal(parseGrader(JSON.stringify({ ...base, requiredCapabilities: null }), "s").ok, false);
  assert.equal(parseGrader(JSON.stringify({ ...base, slug: "other" }), "s").ok, false);
  assert.equal(parseGrader(JSON.stringify(base), "s").ok, true);
  // A missing grader file is an honest skip reason, never a throw:
  const missing = loadGrader("definitely-not-a-case", join(tmpdir(), "run-eval-no-such-grader-dir", "graders"));
  assert.equal(missing.ok, false);
  assert.match(missing.error, /SKIPPED/);
  assert.ok(missing.error.includes("definitely-not-a-case.grader.json"), "skip reason must name the missing grader");
  assert.equal(graderFileFor("x", GRADER_DIR).endsWith(join("graders", "x.grader.json")), true);
});

// ---------------------------------------------------------------------------
// (b) pass@k MATH
// ---------------------------------------------------------------------------

test("(b) choose() is the binomial coefficient, out-of-range is 0", () => {
  assert.equal(choose(3, 0), 1);
  assert.equal(choose(3, 2), 3);
  assert.equal(choose(3, 3), 1);
  assert.equal(choose(3, 4), 0);
  assert.equal(choose(0, 0), 1);
  assert.equal(choose(-1, 0), 0);
});

test("(b) pass@k estimator matches 1 - C(n-c,k)/C(n,k) on synthetic outcomes", () => {
  assert.equal(passAtK(1, 1, 1), 1);
  assert.equal(passAtK(1, 0, 1), 0);
  assert.equal(passAtK(2, 1, 1), 0.5);
  assert.equal(passAtK(3, 1, 1), 0.3333);
  assert.equal(passAtK(3, 1, 2), 0.6667); // 1 - C(2,2)/C(3,2)
  assert.equal(passAtK(3, 2, 2), 1); // 1 - C(1,2)/C(3,2)
  assert.equal(passAtK(3, 0, 2), 0);
  assert.equal(passAtK(3, 3, 3), 1);
  assert.equal(passAtK(4, 2, 2), 0.8333); // 1 - C(2,2)/C(4,2)
  // k beyond the observed trials clamps to n instead of inventing a number:
  assert.equal(passAtK(3, 1, 5), passAtK(3, 1, 3));
  // Invalid records are null — never a fabricated 0:
  assert.equal(passAtK(0, 0, 1), null);
  assert.equal(passAtK(2, 3, 1), null);
  assert.equal(passAtK(2, -1, 1), null);
  assert.equal(passAtK(2.5, 1, 1), null);
});

test("(b) pass^k reliability estimator is C(c,k)/C(n,k)", () => {
  assert.equal(passCaretK(3, 3, 3), 1);
  assert.equal(passCaretK(3, 2, 3), 0);
  assert.equal(passCaretK(3, 2, 2), 0.3333);
  assert.equal(passCaretK(4, 3, 2), 0.5);
  assert.equal(passCaretK(1, 1, 1), 1);
  assert.equal(passCaretK(1, 0, 1), 0);
  assert.equal(passCaretK(0, 0, 1), null);
});

test("(b) trialsSummary classifies flakiness honestly (strict boolean counting)", () => {
  const all = trialsSummary([true, true, true], { k: 3 });
  assert.equal(all.trials, 3);
  assert.equal(all.passes, 3);
  assert.equal(all.flaky, false);
  assert.equal(all.passAt1, 1);
  assert.equal(all.passAtK, 1);
  assert.equal(all.passAllTrials, 1);
  assert.equal(all.flakinessMeasurable, true);
  assert.equal(all.note, null);

  const flip = trialsSummary([true, false], { k: 2 });
  assert.equal(flip.flaky, true, "a case that flips between trials is FLAKY");
  assert.equal(flip.passes, 1);
  assert.equal(flip.failed, 1);
  assert.equal(flip.passAt1, 0.5);
  // Parent boundary fix (W5): standard post-hoc pass@k (Chen et al.) is
  // 1 − C(n−c,k)/C(n,k). Here n=2, c=1, k=2 → 1 − C(1,2)/C(2,2) = 1 (any draw
  // of 2 from 2 includes the single pass). The original 0.5 conflated pass@k
  // with the mean pass@1 — the implementation was right, the expectation wrong.
  assert.equal(flip.passAtK, 1);
  assert.equal(flip.passAllTrials, 0);

  const stableFail = trialsSummary([false, false, false], { k: 3 });
  assert.equal(stableFail.flaky, false, "no passes is a stable fail, not flaky");
  assert.equal(stableFail.passes, 0);
  assert.equal(stableFail.passAt1, 0);

  const oneTrial = trialsSummary([true], { k: 1 });
  assert.equal(oneTrial.flaky, false);
  assert.equal(oneTrial.flakinessMeasurable, false, "1 trial cannot measure flakiness");
  assert.match(oneTrial.note, /1 trial/);
  assert.equal(oneTrial.passAt1, 1);

  const kTooBig = trialsSummary([true, false, true], { k: 5 });
  assert.equal(kTooBig.k, 5);
  assert.equal(kTooBig.kEffective, 3, "k clamps to the observed trial count");

  const empty = trialsSummary([], { k: 3 });
  assert.equal(empty.trials, 0);
  assert.equal(empty.passAt1, null);
  assert.equal(empty.flaky, null);

  // Only a literal `true` is a pass — no truthiness inflation.
  const truthy = trialsSummary(["yes", 1, {}], { k: 3 });
  assert.equal(truthy.passes, 0, "non-boolean outcomes must not inflate passes");
});

test("(b) passesAcceptance ANDs the rubric threshold with the run-side file/content assertions", () => {
  const grader = {
    passWhen: { meanAtLeast: 1, requireExpectedFiles: true, requireExpectedContent: true },
  };
  const okAcc = { filesOk: true, contentOk: true, missingFiles: [], failedContent: [] };
  assert.equal(passesAcceptance({ mean: 1 }, okAcc, grader), true);
  assert.equal(passesAcceptance({ mean: 0.8889 }, okAcc, grader), false, "below-threshold mean is a fail");
  assert.equal(passesAcceptance({ mean: 1 }, { ...okAcc, filesOk: false, missingFiles: ["index.html"] }, grader), false);
  assert.equal(passesAcceptance({ mean: 1 }, { ...okAcc, contentOk: false, failedContent: ["package.json: missing"] }, grader), false);
  assert.equal(passesAcceptance(null, okAcc, grader), false, "a crashed trial is a fail, never a default pass");
  assert.equal(passesAcceptance({}, okAcc, grader), false);
  const lenient = { passWhen: { meanAtLeast: 0.5, requireExpectedFiles: false, requireExpectedContent: false } };
  assert.equal(passesAcceptance({ mean: 0.5556 }, { ...okAcc, filesOk: false, contentOk: false }, lenient), true);
});

// 255 (W20-L2): the pass verdict is a boolean asked of FOUR different clauses
// (finite mean → mean threshold → files → content). The run-2 record (`pass:no`
// with filesOk+contentOk green and an EMPTY shortfall list) could not name its
// own cause, because the log line only listed missingFiles/failedContent.
// acceptanceFailReason names the FIRST false clause; it must stay clause-exact
// with passesAcceptance (same order, same leniency gate).
test("(b) acceptanceFailReason names the failing clause (mean threshold vs files/content)", () => {
  const grader = { passWhen: { meanAtLeast: 1, requireExpectedFiles: true, requireExpectedContent: true } };
  const okAcc = { filesOk: true, contentOk: true, missingFiles: [], failedContent: [] };
  // The exact run-2 shape: files+content green, 6/9 mean → the ONLY false clause is the threshold.
  assert.equal(passesAcceptance({ mean: 0.6667 }, okAcc, grader), false);
  assert.match(acceptanceFailReason({ mean: 0.6667 }, okAcc, grader), /mean 0\.6667 < 1/);
  assert.equal(acceptanceFailReason({ mean: 1 }, okAcc, grader), null, "green row has no reason");
  assert.match(acceptanceFailReason(null, okAcc, grader), /mean/, "a crashed trial reports the mean clause");
  assert.match(acceptanceFailReason({ mean: 1 }, { ...okAcc, filesOk: false, missingFiles: ["index.html"] }, grader), /index\.html/);
  assert.match(
    acceptanceFailReason({ mean: 1 }, { ...okAcc, contentOk: false, failedContent: ['package.json: missing "test"'] }, grader),
    /package\.json/,
  );
  // Lenient grader: both assertion clauses are OFF → no reason even when red.
  const lenient = { passWhen: { meanAtLeast: 0.5, requireExpectedFiles: false, requireExpectedContent: false } };
  assert.equal(acceptanceFailReason({ mean: 0.5556 }, { ...okAcc, filesOk: false, contentOk: false, missingFiles: ["x"], failedContent: ["y"] }, lenient), null);
});

test("(b) checkAcceptance applies expectedFiles/expectedContent from outside the tree", () => {
  const dir = tempDir("accept");
  try {
    mkdirSync(join(dir, "tests"), { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({ scripts: { test: "node --test" } }), "utf8");
    writeFileSync(join(dir, "README.md"), "# app\n", "utf8");
    writeFileSync(join(dir, "tests", "oracle.spec.ts"), "// spec\n", "utf8");
    const grader = {
      expectedFiles: ["package.json", "README.md", "index.html"],
      expectedContent: [{ file: "package.json", contains: '"test"' }],
      passWhen: { meanAtLeast: 1, requireExpectedFiles: true, requireExpectedContent: true },
    };
    const files = ["package.json", "README.md", "tests/oracle.spec.ts"];
    const res = checkAcceptance(grader, dir, files);
    assert.deepEqual(res.missingFiles, ["index.html"]);
    assert.equal(res.filesOk, false);
    assert.equal(res.contentOk, true, `content should match: ${JSON.stringify(res.failedContent)}`);
    assert.deepEqual(res.checked, { expectedFiles: 3, expectedContent: 1 });

    const full = checkAcceptance({ ...grader, expectedFiles: ["package.json", "README.md"] }, dir, files);
    assert.equal(full.filesOk, true);
    assert.equal(full.contentOk, true);

    const empty = checkAcceptance(grader, dir, []);
    assert.equal(empty.filesOk, false);
    assert.equal(empty.contentOk, false, "an unmatchable content assertion fails, not passes");
    assert.ok(empty.failedContent.length > 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// (c) HONEST KEYLESS SKIPS
// ---------------------------------------------------------------------------

test("(c) keyless notices state what the run does NOT do (and leak no key material)", () => {
  const plainKeyless = keylessSkipNotices({ keyedRequested: false, hasKey: false });
  assert.equal(plainKeyless.length, 1);
  assert.match(plainKeyless[0], /keyless floor/);
  assert.match(plainKeyless[0], /no model calls/);
  assert.match(plainKeyless[0], /no model text is fabricated/);

  const requested = keylessSkipNotices({ keyedRequested: true, hasKey: false });
  assert.equal(requested.length, 3);
  assert.ok(requested.some((n) => n.includes("--keyed requested but DEEPSEEK_API_KEY is unset")), "the fallback must be stated");
  assert.ok(requested.some((n) => n.includes("SKIPPED")), "the keyed-only stages must be reported as skipped");
  assert.ok(requested.every((n) => !n.includes("DEEPSEEK_API_KEY=")), "never echo a key assignment");

  const keyed = keylessSkipNotices({ keyedRequested: true, hasKey: true });
  assert.deepEqual(keyed, [], "a keyed run makes no keyless claims");

  // No key material can reach the notices: the builder takes booleans only, so
  // this holds even when the environment carries a real key.
  const secret = process.env.DEEPSEEK_API_KEY ?? "";
  if (secret.length > 8) {
    for (const n of [...plainKeyless, ...requested]) {
      assert.equal(n.includes(secret), false, "notices must never contain the API key value");
    }
  }
});

test("(c) a case with no run-side grader is SKIPPED with a reason, never scored", () => {
  const entries = [
    { slug: "has-grader", name: "A", kind: "webapp", brief: "a", expectedCapabilities: ["x"] },
    { slug: "no-grader", name: "B", kind: "webapp", brief: "b", expectedCapabilities: ["y"] },
  ];
  const graders = new Map([
    ["has-grader", { ok: true, path: join(GRADER_DIR, "has-grader.grader.json"), grader: { slug: "has-grader", requiredCapabilities: ["x"], requiredIdentifiers: [] } }],
    ["no-grader", { ok: false, path: join(GRADER_DIR, "no-grader.grader.json"), error: "no run-side grader at X — case SKIPPED (never graded against an undeclared bar)" }],
  ]);
  const plan = planTargets(entries, (slug) => graders.get(slug));
  assert.deepEqual(plan.targets.map((t) => t.entry.slug), ["has-grader"]);
  assert.equal(plan.skips.length, 1);
  assert.equal(plan.skips[0].slug, "no-grader");
  assert.equal(plan.skips[0].kind, "no-grader");
  assert.match(plan.skips[0].reason, /SKIPPED/);
  assert.equal(plan.targets.some((t) => t.entry.slug === "no-grader"), false, "an ungraded case must not run");

  // …and the skip lands in the persisted summary (honest accounting), while the
  // gradeable case keeps its own row.
  const summary = buildSummary(
    [
      {
        entryRow: {
          slug: "has-grader",
          trials: { trials: 1, passes: 0, passAt1: 0, flaky: false },
          graderLeak: { leaked: false },
        },
      },
    ],
    plan.skips,
  );
  assert.equal(summary.skipped, 1);
  assert.equal(summary.skips[0].slug, "no-grader");
  assert.equal(summary.cases, 1);
  assert.deepEqual(summary.graderLeaks, []);
  assert.equal(summary.passAtK.passed, 0);
});

test("(c) buildSummary counts passes, flaky cases and grader leaks without touching legacy keys", () => {
  const row = (slug, trials, leak = false) => ({
    entryRow: { slug, trials, graderLeak: { leaked: leak } },
  });
  const summary = buildSummary([
    row("stable-pass", { trials: 2, passes: 2, passAt1: 1, flaky: false }),
    row("flaky-case", { trials: 2, passes: 1, passAt1: 0.5, flaky: true }, true),
    row("stable-fail", { trials: 2, passes: 0, passAt1: 0, flaky: false }),
  ]);
  assert.equal(summary.cases, 3);
  assert.equal(summary.trials, buildSummary([]).trials, "trials default comes from the driver constant");
  assert.equal(summary.passAtK.passed, 1);
  assert.deepEqual(summary.passAtK.passedSlugs, ["stable-pass"]);
  assert.deepEqual(summary.flakyCases, ["flaky-case"]);
  assert.deepEqual(summary.graderLeaks, ["flaky-case"]);
  assert.equal(summary.passAtK.meanPassAt1, 0.5);
  assert.equal(summary.skipped, 0);
  // The legacy summary keys are produced by persist(), not here — but the
  // W5-L5 block must never redefine them either:
  assert.equal("entries" in summary, false);
  assert.equal("meanTotal" in summary, false);
});

test("(c) the recorded results.json keeps the legacy contract and adds W5-L5 keys", (t) => {
  const resultsPath = join(OUT_DIR, "results.json");
  if (!existsSync(resultsPath)) {
    t.skip("no research/eval-out/results.json yet — run `npm run eval` first");
    return;
  }
  const doc = JSON.parse(readFileSync(resultsPath, "utf8"));
  // Legacy contract (unchanged): generatedAt / mode / corpusDir / entries / summary.
  assert.equal(typeof doc.generatedAt, "string");
  assert.ok(["keyed", "keyless"].includes(doc.mode));
  assert.equal(typeof doc.corpusDir, "string");
  assert.ok(Array.isArray(doc.entries));
  assert.equal(doc.summary.entries, doc.entries.length);
  assert.equal(typeof doc.summary.meanTotal, "number");
  // W5-L5 additive contract:
  assert.equal(typeof doc.graderDir, "string", "graderDir must record where the bar came from");
  assert.equal(typeof doc.summary.trials, "number");
  assert.equal(doc.summary.passAtK.k, doc.summary.trials);
  assert.ok(Array.isArray(doc.summary.skips));
  assert.ok(Array.isArray(doc.summary.flakyCases));
  assert.ok(Array.isArray(doc.summary.graderLeaks));
  for (const entry of doc.entries) {
    assert.equal(typeof entry.grader.path, "string", `${entry.slug}: grader provenance`);
    assert.equal(typeof entry.grader.hash, "string");
    assert.equal(typeof entry.trials.trials, "number");
    assert.equal(typeof entry.graderLeak.leaked, "boolean");
    assert.ok(Array.isArray(entry.perTrial));
    assert.equal(entry.perTrial.length, entry.trials.trials);
  }
  // No grader content leaked into the recorded evidence either.
  for (const entry of doc.entries) {
    const g = loadGrader(entry.slug);
    if (!g.ok) continue;
    assert.equal(JSON.stringify(entry).includes(g.grader.acceptanceBar), false, `${entry.slug}: results.json must not echo the bar into the evidence file`);
  }
});

// ---------------------------------------------------------------------------
// (d) fixes/237 — C-2 (`223` §4, `230` OV-5(a)): a hard-DoD stop is a CODED
// TERMINAL stop in the drain. Today the terminal set is {complete, blocked,
// error}, so a `dod` round (headless.ts:587-606 — a real hard stop) reads as
// "progress" and the drain re-enters the block for its full 80-round guard
// (~80 `dod.blocked` rows), then reports a SILENT `position:"stalled",
// onTime:false` → M9=0. These two pins close that.
// ---------------------------------------------------------------------------

test("(d) drain terminality pins all seven RunOutcome values", () => {
  // The seven RunOutcome values (src/lib/headless.ts:527).
  const terminal = ["complete", "blocked", "error", "dod"];
  const looping = ["hitl", "progress", "cap"];
  for (const o of terminal) {
    assert.equal(isTerminalDrainOutcome(o), true, `${o} must end the drain`);
  }
  for (const o of looping) {
    assert.equal(isTerminalDrainOutcome(o), false, `${o} must not end the drain (hitl is approved + continued; progress/cap keep looping)`);
  }
  assert.equal(new Set([...terminal, ...looping]).size, 7, "exactly the seven RunOutcome values are pinned");
});

test("(d) the drain exits on the FIRST dod round with a coded stop (WB-2 → M9)", async () => {
  // Same shape as `223` §C-2's scratch probe: a project COMPLETE at phase 1
  // with a red gate under enforceDod:true — runUntilGate returns outcome
  // "dod", stopped, cursor unmoved (the headless.test.ts:1744 recipe).
  const p0 = createProject({
    brief: "Build a small notes app with add/list/search and its own tests.",
    name: "DodDrain",
  });
  const stepped = await runUntilGate({ ...p0, enforceDod: false }, { maxSteps: 1 });
  assert.equal(stepped.project.currentPhase, 1, "precondition: P0 advanced under advisory");
  const sabotaged = {
    ...stepped.project,
    enforceDod: true,
    currentPhase: 1,
    phases: stepped.project.phases.map((ph) =>
      ph.id === 1 ? { ...ph, status: "complete", startedAt: Date.now() } : ph,
    ),
  };
  const rowsBefore = (sabotaged.logs ?? []).filter((l) => l.event === "dod.blocked").length;
  assert.equal(rowsBefore, 0, "precondition: no dod.blocked row yet");

  const drain = await drainPipeline(sabotaged);
  assert.equal(drain.res.outcome, "dod", "the round really is the hard-DoD stop");
  assert.equal(drain.position, "dod", "a hard stop parks as its own coded position, never a silent stall");
  assert.equal(drain.onTime, true, "the drain stopped WITH a terminal state (M9's first branch)");
  assert.equal(drain.code, "RT_E_GATE_PENDING", "the stop carries the wild path's code for the same block (engine.ts:3571)");
  assert.match(String(drain.stall), /DoD unmet/, "the stall evidence is the hard-DoD message");
  const rowsAfter = (drain.p.logs ?? []).filter((l) => l.event === "dod.blocked").length;
  assert.equal(rowsAfter, 1, `exactly ONE drain round ran the hard-DoD block — got ${rowsAfter} (80 before this fix)`);
  assert.equal(drain.p.currentPhase, 1, "cursor unmoved — a hard stop advances nothing");
  assert.equal(drain.approved.length, 0, "no gate was approved on the way out");
});

// ---------------------------------------------------------------------------
// (e) OV-35 (fixes/244, W16-L1) — the Step-0 preflight: OV-27 reachability +
// failure-class triage + kill-safety run marker. The three clauses `235` §2
// row 3 names as unasserted are pinned here: (a) marker ORDERING (before entry
// 1), (b) one distinct coded output per preflight class (stubbed 401/402/400),
// (c) the keyless path writes nothing new.
// ---------------------------------------------------------------------------

test("OV-35: the run-start marker is written before the first corpus entry", async () => {
  const dir = tempDir("marker-order");
  try {
    const seen = [];
    const selected = [{ entry: { slug: "case-a" } }, { entry: { slug: "case-b" } }];
    const out = await runWithMarker(selected, {
      mode: "keyed",
      outDir: dir,
      runner: async (t) => {
        seen.push({ slug: t.entry.slug, marker: readRunMarker(dir) });
        return { entryRow: { slug: t.entry.slug } };
      },
    });
    assert.equal(out.markerPath, join(dir, RUN_MARKER_NAME));
    assert.equal(seen.length, 2, "both entries ran");
    for (const s of seen) {
      assert.ok(s.marker, `${s.slug}: the marker must exist BEFORE the entry runs (ordering, not existence)`);
      assert.equal(s.marker.mode, "keyed");
      assert.equal(s.marker.finishedAt, null, "the marker is UNFINISHED while entries run — a kill at any point leaves it so");
      assert.equal(s.marker.done, false);
      assert.equal(typeof s.marker.startedAt, "string");
      assert.ok(!Number.isNaN(Date.parse(s.marker.startedAt)), "startedAt is a parseable timestamp");
    }
    assert.deepEqual(seen.map((s) => s.slug), ["case-a", "case-b"], "entries ran in order");
    // Unfinished until the caller finalizes AFTER both persists (main does that):
    assert.equal(runMarkerState(dir).state, "unfinished");
    finishRunMarker(dir, { entries: 2 });
    assert.equal(runMarkerState(dir).state, "finished");
    assert.equal(readRunMarker(dir).entries, 2);
    assert.equal(typeof readRunMarker(dir).finishedAt, "string");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("OV-35: preflight maps not-configured/401/402/400 to distinct coded output", () => {
  const cases = [
    [{ configured: false }, "not-configured", "RT_E_LLM_NOT_CONFIGURED"],
    [
      { configured: true, wire: { attempted: true, ok: false, httpStatus: 401, code: "RT_E_LLM_REJECTED", error: "DeepSeek API key is invalid (HTTP 401)" } },
      "auth-rejected",
      "RT_E_LLM_REJECTED",
    ],
    [
      // W24/B2 (fixes/263): W23-L1 gave the vendor's balance class its OWN
      // class+code (`RT_E_LLM_NO_BALANCE` — never the session budget
      // `RT_E_BUDGET_EXHAUSTED`) and the fundedness verdict reads
      // `class === "no-balance"`; this pin was left on the pre-W23-L1 names and
      // was RED at HEAD.
      { configured: true, wire: { attempted: true, ok: false, httpStatus: 402, code: "RT_E_LLM_REJECTED", error: "DeepSeek account balance exhausted (HTTP 402)" } },
      "no-balance",
      "RT_E_LLM_NO_BALANCE",
    ],
    [
      { configured: true, wire: { attempted: true, ok: false, httpStatus: 400, code: "RT_E_LLM_REJECTED", error: "DeepSeek rejected the request (HTTP 400: model not found)", requestedModel: "deepseek-v4-flash" } },
      "request-rejected",
      "RT_E_VALIDATION",
    ],
  ];
  const classes = new Set();
  const codes = new Set();
  for (const [input, cls, code] of cases) {
    const c = classifyLlmPreflight(input);
    assert.equal(c.class, cls);
    assert.equal(c.code, code);
    assert.equal(typeof c.detail, "string");
    classes.add(c.class);
    codes.add(c.code);
    assert.ok(Object.keys(ERROR_CODE_DOC).includes(c.code), `${c.code} must be a real registry code (errors.ts)`);
  }
  assert.equal(classes.size, 4, "the four demanded endings are CLASS-distinct");
  assert.equal(codes.size, 4, "the four demanded endings are CODE-distinct (235 §2 row 3)");
  // The request-rejected detail names the requested model id (D1.4's drift question):
  assert.match(classifyLlmPreflight(cases[3][0]).detail, /deepseek-v4-flash/);
  // The remaining endings classify too (no silent fallthrough):
  assert.equal(classifyLlmPreflight({ configured: true, wire: { attempted: true, ok: false, httpStatus: null, code: "RT_E_NETWORK_UNREACHABLE", error: "fetch failed" } }).class, "unreachable");
  assert.equal(classifyLlmPreflight({ configured: true, wire: { attempted: true, ok: false, httpStatus: null, code: "RT_E_LLM_TIMEOUT", error: "timed out" } }).class, "timeout");
  assert.equal(classifyLlmPreflight({ configured: true, wire: null }).class, "configured-unprobed");
  assert.equal(classifyLlmPreflight({ configured: true, wire: { attempted: true, ok: true, httpStatus: 200, model: "deepseek-v4-flash" } }).class, "wire-ok");
  const ok = classifyLlmPreflight({ configured: true, wire: { attempted: true, ok: true, httpStatus: 200 } });
  assert.equal(ok.code, null, "wire-ok is not a failure — no code");
  assert.equal(ok.ok, true);
});

test("OV-35: a keyless run writes no run-start marker and adds no fields to results.json", async () => {
  const dir = tempDir("keyless-marker");
  try {
    let runnerCalls = 0;
    const out = await runWithMarker([{ entry: { slug: "k" } }], {
      mode: "keyless",
      outDir: dir,
      runner: async () => {
        runnerCalls += 1;
        return { entryRow: { slug: "k" } };
      },
    });
    assert.equal(runnerCalls, 1, "the keyless wrapper still runs the entries");
    assert.equal(out.markerPath, null);
    assert.deepEqual(readdirSync(dir), [], "the keyless path writes NOTHING new next to results.json (durable pin, not a manual diff)");
    assert.equal(runMarkerState(dir).state, "none");
    assert.equal(markerPathFor(dir), join(dir, RUN_MARKER_NAME));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  // The persisted summary schema is pinned by key set — no new fields may appear:
  assert.deepEqual(
    Object.keys(buildSummary([])).sort(),
    ["cases", "flakyCases", "graderLeaks", "passAtK", "skipped", "skips", "trials"],
    "buildSummary's key set is the contract; the keyless path must not gain fields",
  );
});

test("OV-35: a ≤4/9 outcome is routed to the named branch", () => {
  const low = keyedRunDecision({ mode: "keyed", meanOfNine: 3.5 });
  assert.equal(low.branch, "retrace-first");
  assert.match(low.line, /re-trace/i);
  assert.match(low.line, /do not re-run/i, "the wording must name re-trace vs re-run");
  const edge = keyedRunDecision({ mode: "keyed", meanOfNine: 4 });
  assert.equal(edge.branch, "retrace-first", "exactly 4/9 is inside the branch");
  const band = keyedRunDecision({ mode: "keyed", meanOfNine: 5.5 });
  assert.equal(band.branch, "band-expected");
  assert.match(band.line, /log/i);
  const high = keyedRunDecision({ mode: "keyed", meanOfNine: 8 });
  assert.equal(high.branch, "above-prediction");
  const keyless = keyedRunDecision({ mode: "keyless", meanOfNine: 6 });
  assert.equal(keyless.branch, "n/a");
  assert.equal(keyless.line, null, "the rule is keyed-only — keyless stays byte-identical (no line)");
  const nan = keyedRunDecision({ mode: "keyed", meanOfNine: Number.NaN });
  assert.equal(nan.branch, "no-score");
});

test("OV-35: every drain ending and all seven RunOutcome values classify to a coded class", () => {
  // All seven RunOutcome values (headless.ts:527) — none may be silent:
  const outcomes = ["hitl", "complete", "blocked", "error", "progress", "cap", "dod"];
  assert.deepEqual(Object.keys(RUN_OUTCOME_CLASSES).sort(), [...outcomes].sort(), "exactly the seven RunOutcome values are classified");
  for (const o of outcomes) {
    const c = classifyRunOutcome(o);
    assert.equal(c.outcome, o);
    assert.equal(typeof c.class, "string");
    assert.notEqual(c.class, "stalled", "no outcome may classify as a bare silent stall");
    if (c.code !== null) assert.ok(Object.keys(ERROR_CODE_DOC).includes(c.code), `${o}: ${c.code} must be a registry code`);
  }
  // The two stall provenances C-2 left uncoded now carry their registry code:
  const gateStall = classifyDrainEnding({ position: "stalled", outcome: "hitl", code: "RT_E_GATE_PENDING" });
  assert.equal(gateStall.class, "gate-unapprovable");
  assert.equal(gateStall.code, "RT_E_GATE_PENDING");
  const capStall = classifyDrainEnding({ position: "stalled", outcome: "progress", code: "RT_E_BUDGET_EXHAUSTED" });
  assert.equal(capStall.class, "iteration-budget-exhausted");
  assert.equal(capStall.code, "RT_E_BUDGET_EXHAUSTED");
  // An uncoded stall can never be silent either — it reports the emitter bug:
  const uncoded = classifyDrainEnding({ position: "stalled", outcome: null, code: null });
  assert.equal(uncoded.class, "stalled-uncoded");
  assert.equal(uncoded.code, "RT_E_UNKNOWN");
  assert.match(String(uncoded.detail), /emitter bug/);
  // The other positions:
  const p6 = classifyDrainEnding({ position: "p6-gate", outcome: "hitl" });
  assert.equal(p6.class, "p6-handoff");
  assert.equal(p6.code, null);
  const dod = classifyDrainEnding({ position: "dod", outcome: "dod", code: "RT_E_GATE_PENDING" });
  assert.equal(dod.code, "RT_E_GATE_PENDING", "C-2's code survives the triage");
  assert.equal(classifyDrainEnding({ position: "terminal", outcome: "blocked" }).code, "RT_E_GATE_PENDING");
  assert.equal(classifyDrainEnding({ position: "terminal", outcome: "error" }).code, "RT_E_INTERNAL");
  const done = classifyDrainEnding({ position: "terminal", outcome: "complete" });
  assert.equal(done.code, null);
  assert.equal(done.ok, true);
});

test("OV-35: a real unapprovable gate ends the drain as a CODED stall, never a silent one", async () => {
  const p0 = createProject({
    brief: "Build a small notes app with add/list/search and its own tests.",
    name: "GateStall",
  });
  // Park GENUINELY on a stock HITL gate (P4 — `autopilot:false` stops there),
  // then make it forceHuman: the drain's machine-seat approve() refuses it,
  // which is exactly the approve-throw stall branch (was uncoded before OV-35).
  const pre = await runUntilGate(p0, { autopilot: false, maxSteps: 60 });
  assert.equal(pre.project.status, "awaiting_hitl", "precondition: genuinely parked on a gate");
  assert.equal(pre.outcome, "hitl");
  const parked = { ...pre.project, hitl: { ...pre.project.hitl, forceHuman: true } };
  const drain = await drainPipeline(parked);
  assert.equal(drain.position, "stalled", "the unapprovable gate is the stall branch");
  assert.equal(drain.code, "RT_E_GATE_PENDING", "the stall carries the registry code for an unresolved gate");
  assert.equal(drain.ending.class, "gate-unapprovable");
  assert.equal(drain.onTime, false);
  assert.ok(typeof drain.stall === "string" && drain.stall.length > 0, "the stall evidence is preserved");
});

test("OV-35: the reachability probe loads the P6 separate specifiers and classifies a stubbed wire", async () => {
  const before = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = "dummy-key-for-probe-test";
  try {
    // 401 stub: the vendor answers, the key is refused — NO network in tests.
    let calls401 = 0;
    const stub401 = async () => {
      calls401 += 1;
      return new Response(JSON.stringify({ error: { message: "Authentication Fails" } }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    };
    const probe = await probeP6Reachability({ fetchImpl: stub401 });
    assert.equal(probe.configured, true, "the P6 specifier's configured probe must see the dummy key on the bare-node host");
    assert.equal(probe.specifiers.engine.resolved, true);
    assert.equal(probe.specifiers.engine.liveLayer, true);
    assert.equal(probe.specifiers.deepseek.resolved, true);
    assert.equal(probe.specifiers.deepseek.isDeepSeekConfigured, true);
    assert.equal(probe.specifiers.codegen.resolved, true);
    assert.equal(probe.specifiers.codegen.liveP6Synthesis, true);
    assert.equal(probe.wire.attempted, true);
    assert.equal(probe.wire.httpStatus, 401);
    assert.equal(probe.class, "auth-rejected");
    assert.equal(probe.code, "RT_E_LLM_REJECTED");
    assert.ok(calls401 >= 1, "the wire step really called the injected fetch");
    assert.equal(JSON.stringify(probe).includes("dummy-key-for-probe-test"), false, "the probe must never echo the key value");
    const lines = formatPreflightLines(probe);
    assert.ok(lines.some((l) => /configured=true/.test(l)));
    assert.ok(lines.some((l) => /cannot prove/.test(l)), "the probe states what it cannot prove without a real key");
    // A 200 completion stub classifies as wire-ok (model reach for one call):
    const okBody = {
      model: "deepseek-v4-flash",
      choices: [{ message: { content: "OK" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 5, completion_tokens: 1 },
    };
    const probe2 = await probeP6Reachability({
      fetchImpl: async () => new Response(JSON.stringify(okBody), { status: 200, headers: { "content-type": "application/json" } }),
    });
    assert.equal(probe2.class, "wire-ok");
    assert.equal(probe2.ok, true);
    assert.equal(probe2.wire.httpStatus, 200);
    assert.equal(probe2.wire.model, "deepseek-v4-flash");
    // wire:false → configured but UNPROBED (never a silent pass):
    const unprobed = await probeP6Reachability({ wire: false });
    assert.equal(unprobed.class, "configured-unprobed");
    assert.equal(unprobed.wire, null);
    // No key → not-configured, wire skipped entirely:
    delete process.env.DEEPSEEK_API_KEY;
    const keyless = await probeP6Reachability({});
    assert.equal(keyless.configured, false);
    assert.equal(keyless.class, "not-configured");
    assert.equal(keyless.wire, null);
    assert.equal(keyless.specifiers.engine.resolved, true, "the specifiers still resolve keyless");
  } finally {
    if (before === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = before;
  }
});

test("OV-35: an unfinished marker marks a killed run (the stale results.json cannot read as current)", () => {
  const dir = tempDir("killed");
  try {
    writeFileSync(
      join(dir, "results.json"),
      JSON.stringify({ generatedAt: "2026-09-17T02:49:36.070Z", mode: "keyless", entries: [] }),
      "utf8",
    );
    assert.equal(runMarkerState(dir).state, "none", "no marker yet");
    writeRunStartMarker(dir, { mode: "keyed", entries: 6, startedAt: "2026-09-24T01:00:00.000Z" });
    const state = runMarkerState(dir);
    assert.equal(state.state, "unfinished");
    assert.ok(state.note && /results\.json/.test(state.note), "the read states what cannot be trusted");
    assert.ok(/killed/.test(state.note));
    // The stale file is still on disk (the kill cannot remove it) — the marker
    // is the only signal that separates it from THIS run's result:
    const stale = JSON.parse(readFileSync(join(dir, "results.json"), "utf8"));
    assert.ok(stale.generatedAt < readRunMarker(dir).startedAt, "the stale file PREDATES the killed run");
    // A rerun overwrites the marker at start (WB-6: no double-kill confusion):
    writeRunStartMarker(dir, { mode: "keyed", entries: 1, startedAt: "2026-09-24T02:00:00.000Z" });
    assert.equal(runMarkerState(dir).state, "unfinished");
    finishRunMarker(dir, { entries: 1 });
    const finished = runMarkerState(dir);
    assert.equal(finished.state, "finished");
    assert.equal(finished.marker.done, true);
    assert.equal(typeof finished.marker.finishedAt, "string");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// (e) OV-7 (W19-L4) — corpus spread + grader FREEZE + the brief leak scan.
//
// The row's done-when: "M7 measurable across ≥2 domains; graders frozen and
// leak-scanned". These pins hold the three halves without running the (slow)
// eval pipeline; the row's own evidence run (`npm run eval -- --trials=2`) is
// the integration proof and lives in fixes/252_lane4_ov7.md.
// ---------------------------------------------------------------------------

test("OV-7: the corpus spans ≥2 domains and ≥2 of them carry ≥2 fixtures (a citable same-domain peer)", () => {
  const found = listCorpusEntries();
  const entries = found.filter((f) => f.entry !== null).map((f) => f.entry);
  assert.ok(entries.length >= 7, `expected the seven corpus fixtures, saw ${entries.length}`);
  const index = corpusDomainIndex(entries);
  const domains = Object.keys(index);
  assert.ok(domains.length >= 2, `the corpus must span ≥2 domains, saw ${domains.length}: ${domains.join(", ")}`);
  const multi = domains.filter((d) => index[d].length >= 2);
  assert.ok(
    multi.length >= 2,
    `expected ≥2 domains with ≥2 fixtures (the OV-7 expansion), saw ${multi.length}: ${JSON.stringify(index)}`,
  );
  // The domain the expansion targeted: construction had exactly one fixture
  // before this lane; its peer is permit-inspection-tracker.
  assert.ok((index.construction ?? []).length >= 2, `construction needs its second fixture: ${JSON.stringify(index.construction ?? [])}`);
  assert.ok((index["real-estate"] ?? []).length >= 2, `real-estate keeps its fixture set: ${JSON.stringify(index["real-estate"] ?? [])}`);
  // Trap guard (230 §OV-7): a domain's second fixture must not duplicate a brief.
  for (const d of multi) {
    const briefs = index[d].map((slug) => entries.find((e) => e.slug === slug).brief.trim());
    assert.ok(briefs.every((b) => b.length > 0), `${d}: every fixture must carry a brief`);
    assert.equal(new Set(briefs).size, briefs.length, `${d}: fixture briefs must be distinct, not copies`);
  }
});

test("OV-7: the agent-facing brief carries no grader text (real corpus) and a planted leak is caught", () => {
  const entries = listCorpusEntries().filter((f) => f.entry !== null).map((f) => f.entry);
  for (const entry of entries) {
    const g = loadGrader(entry.slug);
    assert.equal(g.ok, true, `${entry.slug}: ${g.ok ? "" : g.error}`);
    const scan = briefLeakScan(entry, g.grader);
    assert.equal(scan.leaked, false, `${entry.slug}: agent-facing brief carries grader text: ${JSON.stringify(scan.hits)}`);
    assert.deepEqual(scan.fields, ["brief", "name"], "the agent-facing surface is exactly brief + name (what createProject receives)");
  }
  // Control: a scan that cannot fail is not a scan — bake the bar into a
  // synthetic brief and it MUST be flagged (the playbook's named trap).
  const g = loadGrader("permit-inspection-tracker");
  assert.equal(g.ok, true);
  const planted = briefLeakScan(
    { slug: "x", name: "X", brief: `build it so that ${g.grader.acceptanceBar}` },
    g.grader,
  );
  assert.equal(planted.leaked, true);
  assert.deepEqual(planted.hits, [{ field: "brief", marker: "acceptanceBar" }]);
  const byName = briefLeakScan({ slug: "x", name: "permit-inspection-tracker.grader.json", brief: "clean brief" }, g.grader);
  assert.equal(byName.leaked, true);
  assert.deepEqual(byName.hits, [{ field: "name", marker: "graderFile" }]);
  // A brief that legitimately names the demanded capabilities is NOT a leak:
  const clean = briefLeakScan({ slug: "x", name: "X", brief: "a permit tracker with inspections and punch lists" }, g.grader);
  assert.equal(clean.leaked, false);
});

test("OV-7: grader freeze — an untouched grader verifies ok; a mid-run edit is caught and named", () => {
  const dir = tempDir("freeze");
  try {
    const path = join(dir, "frozen.grader.json");
    const text = JSON.stringify({
      slug: "frozen",
      acceptanceBar: "the original bar text",
      requiredIdentifiers: [],
      requiredCapabilities: [],
    });
    writeFileSync(path, text, "utf8");
    const fp = { slug: "frozen", ...graderFreezeFingerprint(path) };
    assert.equal(fp.readable, true);
    assert.equal(typeof fp.hash, "string");
    assert.equal(fp.bytes, text.length);
    // Unchanged since the fingerprint → the run is gradeable:
    const ok = verifyGraderFreeze([fp]);
    assert.deepEqual(ok, { checked: 1, ok: true, changed: [] });
    // Edited mid-run (the bar is weakened by one word) → flagged with slug + hashes:
    writeFileSync(path, text.replace("original", "softened!!"), "utf8");
    const moved = verifyGraderFreeze([fp]);
    assert.equal(moved.ok, false);
    assert.equal(moved.changed.length, 1);
    assert.equal(moved.changed[0].slug, "frozen");
    assert.equal(moved.changed[0].reason, "bytes-changed-mid-run");
    assert.notEqual(moved.changed[0].hashAtStart, moved.changed[0].hashNow);
    // Deleted mid-run → flagged as unreadable, never a throw:
    rmSync(path);
    const gone = verifyGraderFreeze([fp]);
    assert.equal(gone.ok, false);
    assert.equal(gone.changed[0].reason, "unreadable-since-start");
    // A grader that was already missing at fingerprint time is honest, not fatal:
    const absent = graderFreezeFingerprint(join(dir, "nope.grader.json"));
    assert.equal(absent.readable, false);
    assert.equal(absent.hash, null);
    assert.equal(verifyGraderFreeze([absent]).ok, false, "an unreadable grader can never verify as frozen");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("OV-7: the driver resolves each grader exactly once, at plan time (freeze by construction)", () => {
  let calls = 0;
  const entries = [{ slug: "a" }, { slug: "b" }, { slug: "c" }];
  const plan = planTargets(entries, (slug) => {
    calls += 1;
    return {
      ok: true,
      path: `graders/${slug}.grader.json`,
      grader: { slug, acceptanceBar: "bar", requiredIdentifiers: [], requiredCapabilities: [] },
    };
  });
  assert.equal(calls, entries.length, "one resolution per entry — the plan is the only load site");
  assert.equal(plan.targets.length, 3);
  assert.deepEqual(plan.skips, [], "every case with a grader is a target");
  for (const t of plan.targets) {
    assert.equal(t.grader.slug, t.entry.slug, "each target carries the PLAN-TIME grader object");
    assert.equal(typeof t.graderPath, "string", "the path rides the target — for the freeze fingerprint only");
  }
});

test("OV-7: M7 prior resolution — rows resolve per slug across domains; a first run is honestly null", () => {
  const dir = tempDir("m7-history");
  try {
    const historyPath = join(dir, "history.json");
    writeFileSync(
      historyPath,
      JSON.stringify([
        { at: "t1", mode: "keyless", slug: "real-estate-crm", m1: 0, m2: 1, m3: 0 },
        { at: "t2", mode: "keyless", slug: "field-ops-suite", m1: 0, m2: 0, m3: 0 },
      ]),
      "utf8",
    );
    // Two domains, both resolvable — the prior exists in each:
    assert.deepEqual(priorFor("real-estate-crm", historyPath), { m1: 0, m2: 1, m3: 0 });
    assert.deepEqual(priorFor("field-ops-suite", historyPath), { m1: 0, m2: 0, m3: 0 });
    // A slug with no rows is null — "no prior same-domain run", never a fabricated 0/0/0:
    assert.equal(priorFor("permit-inspection-tracker", historyPath), null);
    // The LAST recorded row wins (run #3 cites run #2, not run #1):
    writeFileSync(
      historyPath,
      JSON.stringify([
        { at: "t1", slug: "x", m1: 0, m2: 0, m3: 0 },
        { at: "t2", slug: "x", m1: 1, m2: 1, m3: 1 },
      ]),
      "utf8",
    );
    assert.deepEqual(priorFor("x", historyPath), { m1: 1, m2: 1, m3: 1 });
    // A missing/corrupt history file is a first-run, never a throw:
    assert.equal(priorFor("x", join(dir, "absent.json")), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// W24/B2 (fixes/263_lane2_periphery_bughunt.md) — the W23-L1 eval wires.
// Every fetch below is STUBBED: no request leaves the process, no keyed call.
// ---------------------------------------------------------------------------

/** A dummy credential for the stubbed-fetch calls. It can never reach the
 *  network: each provider call injects its own `fetch`. */
const W24_B2_DUMMY_KEY = "w24-b2-dummy-not-a-real-key";

test("W24/B2 — a THROWING tap never breaks the call it observes (deepseek.ts tapLlmCall)", async () => {
  const ds = await import("../src/lib/deepseek.server.ts");
  const savedKey = process.env.DEEPSEEK_API_KEY;
  // Keyless: the honest not-configured refusal still dispatches the tap, so the
  // guard is provable without any key, fetch or network.
  delete process.env.DEEPSEEK_API_KEY;
  ds.setLlmCallTap(() => {
    throw new Error("hostile tap — must never reach the caller");
  });
  try {
    const res = await ds.completeDeepSeek("w24/b2 hostile tap");
    assert.equal(res.ok, false);
    assert.equal(res.code, "RT_E_LLM_NOT_CONFIGURED", "the refusal is the provider's own, not the tap's");
  } finally {
    ds.setLlmCallTap(null); // back to the byte-identical no-op path
    if (savedKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = savedKey;
  }
});

test("W24/B2 — the provider call tap is WIRED: install → window → live record → folded evidence", async () => {
  const ds = await import("../src/lib/deepseek.server.ts");
  const savedKey = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = W24_B2_DUMMY_KEY;
  try {
    // The driver's install must succeed against the real provider surface…
    assert.equal(await installLlmCallTap(), true, "the provider module must expose setLlmCallTap");
    assert.equal(llmCallTapIsInstalled(), true);
    // …and the SAME module instance the keyed leg calls must then be observed.
    beginTrialCallTap();
    const bodies = [];
    const res = await ds.completeDeepSeek("w24/b2 tap wire", {
      maxTokens: 1,
      timeoutMs: 5_000,
      fetch: async (_url, init) => {
        bodies.push(JSON.parse(init.body));
        return new Response(
          JSON.stringify({
            id: "chatcmpl-w24b2",
            model: "deepseek-flash",
            choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 11, completion_tokens: 3 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    });
    assert.equal(bodies.length, 1, "the stubbed fetch is the only transport — no network");
    assert.equal(res.ok, true);
    const records = endTrialCallTap();
    assert.equal(records.length, 1, "the installed tap must observe the call inside its window");
    assert.equal(records[0].ok, true);
    assert.equal(records[0].requestedModel, "deepseek-v4-flash");
    assert.equal(records[0].servedModel, "deepseek-flash", "the SERVED id is read back, never the requested alias");
    assert.equal(records[0].promptTokens, 11);
    assert.equal(records[0].completionTokens, 3);
    const ev = llmEvidenceFromCallRecords(records);
    assert.deepEqual(ev.servedModels, ["deepseek-flash"]);
    assert.equal(ev.usage.totalTokens, 14);
    assert.equal(ev.llmCalls, 1);
    assert.equal(ev.failedCalls, 0);
    assert.equal(typeof ev.estimatedCostUsd, "number");
    assert.ok(ev.estimatedCostUsd > 0, "a measured call must never price at 0 (the B2-1 fabricated-zero trap)");
    // The window is per-trial: nothing leaks into the next one, and an empty
    // window is reported as OBSERVED-nothing (never upgraded into a bill claim).
    beginTrialCallTap();
    assert.deepEqual(endTrialCallTap(), []);
    const none = llmEvidenceFromCallRecords([]);
    assert.equal(none.llmCalls, 0);
    assert.match(none.costBasis, /OBSERVED no calls/, "an empty window must not claim 'nothing billed'");
  } finally {
    if (savedKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = savedKey;
  }
});

test("W43/A5 — the cache fold (M4-09): split tap record → usage.cachedPromptTokens; legacy → key absent", async () => {
  const ds = await import("../src/lib/deepseek.server.ts");
  const savedKey = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = W24_B2_DUMMY_KEY;
  try {
    assert.equal(await installLlmCallTap(), true);
    // (a) the vendor response carries DeepSeek's exact cache-split keys → the
    // tap record AND the folded row usage both surface the measured read.
    beginTrialCallTap();
    const split = await ds.completeDeepSeek("w43/a5 cache split", {
      maxTokens: 1,
      timeoutMs: 5_000,
      fetch: async () =>
        new Response(
          JSON.stringify({
            id: "chatcmpl-w43a5a",
            model: "deepseek-flash",
            choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
            usage: {
              prompt_tokens: 11,
              completion_tokens: 3,
              prompt_cache_hit_tokens: 9,
              prompt_cache_miss_tokens: 2,
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    });
    assert.equal(split.ok, true);
    const splitRecords = endTrialCallTap();
    assert.equal(splitRecords.length, 1);
    assert.equal(splitRecords[0].cachedPromptTokens, 9, "the tap record carries the measured hit split");
    assert.equal(splitRecords[0].cacheMissTokens, 2);
    const splitEv = llmEvidenceFromCallRecords(splitRecords);
    assert.equal(splitEv.usage.promptTokens, 11, "the fold still measures the prompt total");
    assert.equal(splitEv.usage.totalTokens, 14);
    assert.equal(splitEv.usage.cachedPromptTokens, 9, "the read-side fold surfaces cache reads to the row");
    // (b) a legacy response with no cache keys → the key stays ABSENT
    // end-to-end (no fabricated 0; record and folded usage keep the legacy shape).
    beginTrialCallTap();
    const legacy = await ds.completeDeepSeek("w43/a5 legacy", {
      maxTokens: 1,
      timeoutMs: 5_000,
      fetch: async () =>
        new Response(
          JSON.stringify({
            id: "chatcmpl-w43a5b",
            model: "deepseek-flash",
            choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 11, completion_tokens: 3 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    });
    assert.equal(legacy.ok, true);
    const legacyRecords = endTrialCallTap();
    assert.equal("cachedPromptTokens" in legacyRecords[0], false, "no measured split → no record key");
    const legacyEv = llmEvidenceFromCallRecords(legacyRecords);
    assert.equal("cachedPromptTokens" in legacyEv.usage, false, "absent stays absent — never a fabricated 0");
    // (c) a non-number cache field is not a report (hostile-shape fold guard).
    const hostileEv = llmEvidenceFromCallRecords([
      { ok: true, promptTokens: 5, completionTokens: 2, cachedPromptTokens: "9" },
    ]);
    assert.equal("cachedPromptTokens" in hostileEv.usage, false, "a string is not a measurement");
  } finally {
    if (savedKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = savedKey;
  }
});

test("W24/B2 — probeFundedness: 402 ⇒ funded:false · answered 200 ⇒ funded:true · keyless ⇒ unaskable", async () => {
  const savedKey = process.env.DEEPSEEK_API_KEY;
  try {
    // (a) keyless — unaskable by construction, ZERO network I/O.
    delete process.env.DEEPSEEK_API_KEY;
    let keylessFetches = 0;
    const off = await probeFundedness({
      fetchImpl: async () => {
        keylessFetches += 1;
        throw new Error("a keyless probe must not reach the network");
      },
    });
    assert.equal(keylessFetches, 0);
    assert.equal(off.configured, false);
    assert.equal(off.attempted, false);
    assert.equal(off.funded, null, "keyless is neither funded nor unfunded — it is unaskable");
    assert.equal(off.code, "RT_E_LLM_NOT_CONFIGURED");

    // (b) dummy key + HTTP 402 ⇒ funded:false, ONE attempt, cheapest call.
    process.env.DEEPSEEK_API_KEY = W24_B2_DUMMY_KEY;
    const bodies = [];
    const p402 = await probeFundedness({
      fetchImpl: async (_url, init) => {
        bodies.push(JSON.parse(init.body));
        return new Response(JSON.stringify({ error: { message: "Insufficient Balance" } }), {
          status: 402,
          headers: { "content-type": "application/json" },
        });
      },
    });
    assert.equal(bodies.length, 1, "402 is not retryable — exactly one attempt");
    assert.equal(bodies[0].max_tokens, 1, "the probe must be the cheapest possible call");
    assert.equal(p402.funded, false, "a broke wallet stops the scored trials");
    assert.equal(p402.class, "no-balance");
    assert.equal(p402.code, "RT_E_LLM_NO_BALANCE");
    assert.equal(p402.httpStatus, 402);
    assert.ok(!JSON.stringify(p402).includes(W24_B2_DUMMY_KEY), "the key VALUE never enters the result");
    const lines = formatFundednessLines(p402);
    assert.ok(lines.some((l) => l.includes("funded=false")));
    assert.ok(lines.some((l) => l.includes("NO-BALANCE")), "the ONE renderer must name the stop");

    // (c) an ANSWERED 200 whose 1-token window truncates to empty content ⇒
    //     funded:true (the account paid). This pins the classify ladder fix:
    //     before it, the 200 status hit the generic `status !== null` branch and
    //     `empty-completion` was unreachable whenever a status was recorded.
    const p200 = await probeFundedness({
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            model: "deepseek-flash",
            choices: [{ message: { content: "" }, finish_reason: "length" }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    });
    assert.equal(p200.class, "empty-completion");
    assert.equal(p200.funded, true, "an answered 200 means the account paid — never read as a refusal");
  } finally {
    if (savedKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = savedKey;
  }
});

test("W24/B2 — WIRING GUARD: the tap install, the fold gate, the fundedness renderer and its skip row stay wired", () => {
  // These four seams are only observable in a LIVE keyed run (impossible here:
  // the account is unfunded), so the regression guard is their call sites in
  // the driver source. A future edit that re-orphans any of them goes red.
  const src = readFileSync(new URL("./run-eval.mjs", import.meta.url), "utf8");
  assert.match(
    src,
    /^\s*tapInstalled = await installLlmCallTap\(\);/m,
    "run-eval.mjs must INSTALL the provider tap (B2-1: it was a dead handler; every keyed trial fabricated $0 evidence)",
  );
  assert.match(
    src,
    /llmEvidenceFromCallRecords\(\s*\n?\s*mode === "keyed" && !llmCallTapIsInstalled\(\) \? null : callRecords,/,
    "the fold must be gated on the tap being installed (nulls, never fabricated zeros)",
  );
  assert.match(src, /for \(const line of formatFundednessLines\(fundedness\)\) console\.log\(line\);/);
  assert.match(src, /kind: "account-unfunded"/, "the fundedness stop must record a skip row (it claimed to)");
  // …and the shape it pushes is the one the summary records verbatim:
  const summary = buildSummary([], [
    { slug: null, kind: "account-unfunded", reason: "fundedness probe stopped the run: (RT_E_LLM_NO_BALANCE)" },
  ]);
  assert.equal(summary.skipped, 1);
  assert.equal(summary.skips[0].kind, "account-unfunded");
});

// ---------------------------------------------------------------------------
// W42·L1-E3 — the missing pins (U1 + Q4-b/c): the run-side evaluators that
// carried NO test coverage before this wave (`git show 4af061a --stat` has no
// test-file pin; `grep -l "entry-runs|evaluateEntryRunsRow|checkExpectedBehavior"
// scripts/run-eval.test.mjs` was 0 hits). All keyless, all bounded:
//   (1) evaluateEntryRunsRow REAL evaluation, driven through the exported
//       checkExpectedBehavior / checkAcceptance seams: temp JS entries are
//       spawned for real — exit 0 within budget passes; exit 1 fails and the
//       row's detail carries the exit code;
//   (2) acceptanceFailReason rides the failed row's own coded detail
//       (≤120 chars — a noisy child cannot bloat the record);
//   (3) historyEndClass tri-state (funded / unfunded / unmeasured);
//   (4) WIRING GUARD for E-1 (entries rows + crash row carry endClass).
// ---------------------------------------------------------------------------

/** Minimal grader for the behavior seams — only `expectedBehavior` matters. */
function behaviorGrader(rows) {
  return {
    passWhen: {
      requireExpectedFiles: false,
      requireExpectedContent: false,
      requireExpectedBehavior: true,
      requireExpectedKind: false,
    },
    expectedFiles: [],
    expectedContent: [],
    expectedBehavior: rows,
  };
}

test("L1-E3(1) — evaluateEntryRunsRow REALLY runs the emitted entry: exit-0 passes, exit-1 fails with the coded detail", () => {
  const dir = mkdtempSync(join(tmpdir(), "run-eval-entryruns-"));
  try {
    writeFileSync(join(dir, "ok-entry.mjs"), "console.log('entry ran');\nprocess.exit(0);\n", "utf8");
    writeFileSync(join(dir, "broken-entry.mjs"), "console.error('boom');\nprocess.exit(1);\n", "utf8");
    const grader = behaviorGrader([
      { id: "e-ok", check: "entry-runs", entry: "ok-entry.mjs" },
      { id: "e-bad", check: "entry-runs", entry: "broken-entry.mjs" },
    ]);
    const files = ["ok-entry.mjs", "broken-entry.mjs"];

    const behavior = checkExpectedBehavior(grader, dir, files);
    assert.equal(behavior.declared, 2);
    assert.equal(behavior.pending, 0, "the pre-U1 `pending` never-evaluated status must never come back");
    const okRow = behavior.rows.find((r) => r.id === "e-ok");
    const badRow = behavior.rows.find((r) => r.id === "e-bad");
    assert.equal(okRow.status, "pass", "an exit-0 entry within budget passes — a REAL bounded spawn, not a structural skip");
    assert.match(okRow.detail, /exit 0 in \d+ms/);
    assert.equal(badRow.status, "fail", "a broken artifact FAILS the row — never a silent pass");
    assert.match(badRow.detail, /exit 1 ≠ declared exit 0/);
    assert.match(badRow.detail, /exec of broken-entry\.mjs/);
    assert.equal(behavior.ok, false);

    // The same verdict rides the acceptance record — `behaviorOk:false`, the
    // clause passesAcceptance ANDs — and the coded reason names the row's own
    // exit code (Q4-b tail).
    const acceptance = checkAcceptance(grader, dir, files);
    assert.equal(acceptance.behaviorOk, false);
    assert.equal(acceptance.behavior.rows.length, 2);
    const reason = acceptanceFailReason({ mean: 9 }, acceptance, grader);
    assert.match(reason, /expected behavior failed: e-bad/);
    assert.match(reason, /exit 1/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("L1-E3(2) — acceptanceFailReason carries the failed row's own coded detail, bounded at 120 chars", () => {
  const grader = {
    passWhen: {
      meanAtLeast: 1,
      requireExpectedFiles: false,
      requireExpectedContent: false,
      requireExpectedBehavior: true,
      requireExpectedKind: false,
    },
  };
  const acceptance = {
    behaviorOk: false,
    behavior: {
      rows: [
        { id: "r1", check: "entry-runs", entry: "cli.js", status: "fail", detail: "exit 7 ≠ declared exit 0 (exec of cli.js)" },
      ],
    },
  };
  const reason = acceptanceFailReason({ mean: 5 }, acceptance, grader);
  assert.match(reason, /expected behavior failed: r1/);
  assert.match(reason, /\(cli\.js\)/, "the row's location rides the reason");
  assert.match(reason, /exit 7 ≠ declared exit 0/, "the row's OWN coded detail rides the reason (Q4-b tail)");

  const huge = "X".repeat(500);
  const noisy = acceptanceFailReason(
    { mean: 5 },
    { behaviorOk: false, behavior: { rows: [{ id: "r2", status: "fail", detail: huge }] } },
    grader,
  );
  assert.ok(noisy.includes("X".repeat(120)), "the detail keeps its first 120 chars");
  assert.ok(!noisy.includes("X".repeat(121)), "and is bounded at 120 — a noisy child cannot bloat the record");
});

test("L1-E3(3) — historyEndClass tri-state: unfunded wins, funded needs a scored keyed verdict, else unmeasured", () => {
  assert.equal(historyEndClass({ notes: { noBalance: true } }, "keyed"), "unfunded", "a broke wallet is never a measurement");
  assert.equal(historyEndClass({ notes: {}, acceptance: { pass: true } }, "keyed"), "funded");
  assert.equal(historyEndClass({ notes: {}, acceptance: { pass: false } }, "keyed"), "funded", "a scored FAIL is still a paid measurement");
  assert.equal(historyEndClass({ notes: {}, acceptance: { pass: true } }, "keyless"), "unmeasured", "keyless is the floor — no wallet was involved");
  assert.equal(historyEndClass({ notes: {} }, "keyed"), "unmeasured", "no verdict → unmeasured");
  assert.equal(historyEndClass({}, "keyed"), "unmeasured", "a row without acceptance/notes never throws");
  assert.equal(historyEndClass(null, "keyed"), "unmeasured", "a missing row never throws");
  // E-1's seam: the class is computed from `acceptance` + `notes.noBalance` —
  // the two keys every entries row carries at classification time. A synthetic
  // entries-shaped row classifies exactly like the trial rows persist() records.
  const entryLike = { acceptance: { pass: false }, notes: { noBalance: false } };
  assert.equal(historyEndClass(entryLike, "keyed"), "funded");
  assert.equal(historyEndClass(entryLike, "keyless"), "unmeasured");
});

test("L1-E3(4) — WIRING GUARD: entries rows + the crash row carry endClass (E-1)", () => {
  // The end-to-end value is covered by the keyless scratch smoke; this pins
  // the two landing sites in the driver source so a future edit that drops
  // either goes red without a full pipeline run.
  const src = readFileSync(new URL("./run-eval.mjs", import.meta.url), "utf8");
  assert.match(src, /entryRow\.endClass = historyEndClass\(entryRow, mode\);/, "every entries row must carry the end class");
  assert.match(src, /endClass: "unmeasured",/, "the crash-fallback row must class as unmeasured");
});

// ---------------------------------------------------------------------------
// W42·L1-E6 — run-eval hygiene cluster pins (atomic writes, bounded history).
// ---------------------------------------------------------------------------

test("L1-E6(a) — writeJsonAtomic: atomic replacement, no tmp leftovers, and a failed rename never clobbers the old target", () => {
  const dir = mkdtempSync(join(tmpdir(), "run-eval-atomic-"));
  try {
    const target = join(dir, "out", "results.json");
    writeJsonAtomic(target, { a: 1, b: [true, null] });
    assert.deepEqual(JSON.parse(readFileSync(target, "utf8")), { a: 1, b: [true, null] }, "the payload lands (mkdir + tmp + rename)");
    assert.equal(
      readdirSync(join(dir, "out")).filter((n) => n.endsWith(".tmp")).length,
      0,
      "no temp leftover after a successful rename",
    );
    writeJsonAtomic(target, { a: 2 });
    assert.deepEqual(JSON.parse(readFileSync(target, "utf8")), { a: 2 }, "rename replaces the previous bytes");

    // Failed-rename path (no injection seam needed): rename(2) onto an existing
    // directory fails (EPERM on this host; EISDIR/ENOTDIR elsewhere) — the OLD
    // target must survive untouched (never truncated, never half-written).
    const blocked = join(dir, "blocked.json");
    mkdirSync(blocked);
    writeFileSync(join(blocked, "keep.txt"), "keep");
    assert.throws(() => writeJsonAtomic(blocked, { nope: true }), "a failed rename must surface, not lie");
    assert.equal(readFileSync(join(blocked, "keep.txt"), "utf8"), "keep", "the previous target bytes are intact");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("L1-E6(b) — MAX_HISTORY_ROWS pins the append bound + the persist slice wiring", () => {
  assert.equal(MAX_HISTORY_ROWS, 200, "the bound is 200 rows");
  // Slice semantics: the NEWEST rows survive (this run's included) and the
  // kept count never exceeds the cap.
  const rows = Array.from({ length: 260 }, (_, i) => i);
  const kept = rows.slice(-MAX_HISTORY_ROWS);
  assert.equal(kept.length, MAX_HISTORY_ROWS);
  assert.equal(kept[kept.length - 1], 259, "the newest (this run's) row is kept");
  assert.ok(!kept.includes(0), "the oldest rows are the ones dropped");
  // Wiring guard: persist() slices before the atomic write — and both persists
  // are atomic (no bare writeFileSync of results/history remains).
  const src = readFileSync(new URL("./run-eval.mjs", import.meta.url), "utf8");
  assert.match(src, /writeJsonAtomic\(RESULTS_PATH, results\)/, "results.json persists atomically");
  assert.match(src, /writeJsonAtomic\(HISTORY_PATH, history\.slice\(-MAX_HISTORY_ROWS\)\)/, "history.json is capped + atomic");
});

// ---------------------------------------------------------------------------
// W44 · T5.4 (fixes/318_a1_oracle.md) — the eval driver's bounded run-level
// telemetry: catalogue-legal rows only (the guardrail refuses invented
// names), host "cli", scope "eval-run", written where resolveLogDir points.
// ---------------------------------------------------------------------------

test("T5.4 — emitEvalRunRow writes catalogue-legal eval-run rows and refuses an invented name", () => {
  const dir = mkdtempSync(join(tmpdir(), "eval-rt-"));
  const saved = process.env.RAPIDTOOL_LOG_DIR;
  process.env.RAPIDTOOL_LOG_DIR = dir;
  try {
    emitEvalRunRow({
      level: "info",
      scope: "eval-run",
      event: "eval.run_start",
      message: "t5.4 pin · start",
      capture: "run-eval.test.mjs:0",
      payload: { mode: "keyless", targets: 1 },
    });
    emitEvalRunRow({ level: "info", scope: "eval-run", event: "eval.invented", message: "must be refused", capture: "run-eval.test.mjs:0" });
    const file = join(dir, "rapidtool.ndjson");
    assert.ok(existsSync(file), "the legal row must land in resolveLogDir's file");
    const rows = readFileSync(file, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    assert.equal(rows.length, 1, "exactly one row — the invented name is refused, never fabricated");
    assert.equal(rows[0].host, "cli", "host glue stamps cli");
    assert.equal(rows[0].scope, "eval-run", "the eval-run scope");
    assert.equal(rows[0].event, "eval.run_start");
    assert.ok(isKnownRtEvent(rows[0].event), "the emitted name is a catalogue member");
    assert.equal(rows[0].payload.mode, "keyless", "flat-scalar payload survives sanitize");
  } finally {
    if (saved === undefined) delete process.env.RAPIDTOOL_LOG_DIR;
    else process.env.RAPIDTOOL_LOG_DIR = saved;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("T5.4 wiring guard — the driver's bounded emit sites + the guardrail are in the source", () => {
  const src = readFileSync(new URL("./run-eval.mjs", import.meta.url), "utf8");
  assert.match(src, /if \(!seed \|\| !isKnownRtEvent\(seed\.event\)\) return;/, "the emitter refuses unknown names");
  assert.match(src, /event: "eval\.run_start"/, "a run-start row");
  assert.match(src, /event: "eval\.run_end"/, "run-end rows (main + empty-corpus paths)");
  assert.match(src, /event: "eval\.run_error"/, "the top-catch crash row");
  const emits = src.match(/emitEvalRunRow\(\{/g) ?? [];
  assert.equal(emits.length, 4, `the bounded set: start + end(main) + end(empty) + error — got ${emits.length}`);
});

