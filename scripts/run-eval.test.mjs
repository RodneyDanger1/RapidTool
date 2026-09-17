import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  buildSummary,
  checkAcceptance,
  choose,
  graderFileFor,
  graderLeakScan,
  keylessSkipNotices,
  loadGrader,
  parseGrader,
  passAtK,
  passCaretK,
  passesAcceptance,
  planTargets,
  scoringCorpusFor,
  trialEmitDir,
  treeTextFiles,
  trialsSummary,
} from "./run-eval.mjs";
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
