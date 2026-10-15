// W359 PAUSED 2026-10-15 - work in progress; see wave_plans/W359/HANDOFF.md for what landed, what is half-done and what is left.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
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
  declaredCorpusKind,
  drainPipeline,
  emitEvalRunRow,
  endTrialCallTap,
  evalOutRefusal,
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
  persist,
  passAtK,
  passCaretK,
  passesAcceptance,
  planTargets,
  priorFor,
  probeFundedness,
  probeP6Reachability,
  projectKindForEntry,
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
import { createProject, promoteEmittedTreeTested, runUntilGate } from "../src/lib/headless.ts";
import { ERROR_CODE_DOC } from "../src/lib/errors.ts";
import { isKnownRtEvent } from "../src/lib/rt-events.ts";
import { intentLattice } from "../src/lib/algorithms.ts";
import { projectRoot } from "./with-app-env.mjs";

/**
 * W5-L5 / T-107.5 (`wave_plans/W5/lane-5.md`) â€” pins for the run-side grader
 * layer + trials/pass@k accounting of the maker-loop eval driver.
 *
 * Three claims, each provable WITHOUT running the (slow) eval pipeline:
 *   (a) GRADER INVISIBILITY â€” every corpus case's acceptance bar lives in a
 *       run-side grader file that is outside every emit path, the driver grades
 *       from it (never from the frontmatter copy), and no emitted tree on disk
 *       contains or references it (leak scan, with a planted-leak control so
 *       the scan itself is falsifiable).
 *   (b) pass@k MATH â€” the human-eval estimator + pass^k + the flakiness
 *       classification, on synthetic outcomes, including the edge cases
 *       (k > n, 1 trial = flakiness unmeasurable, strict `true` counting).
 *   (c) HONEST KEYLESS SKIPS â€” a keyless run says what it does NOT do, a
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
    assert.ok(g.ok, `${slug}: ${g.ok ? "" : g.error}`);
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
  assert.ok(g.ok, "the grader must load");
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

test("F4 (314): treeRunToEvidence carries the verdict hash â€” and never invents one", () => {
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
  assert.ok(hashed, "a runnable outcome maps to evidence");
  assert.equal(hashed.ok, true);
  assert.equal(hashed.testsPass, 4);
  assert.equal(hashed.verdictHash, "deadbeefcafef00d");
  // Legacy/no-hash evidence stays legacy-shaped â€” the key is omitted, never guessed.
  const legacy = treeRunToEvidence({ ok: true, dir: "d", tests: [] });
  assert.ok(legacy);
  assert.equal(legacy.verdictHash, undefined);
  // Empty-string hash is not a hash.
  const emptyHash = treeRunToEvidence({ ok: true, tests: [], verdictHash: "" });
  assert.ok(emptyHash);
  assert.equal(emptyHash.verdictHash, undefined);
  assert.equal(treeRunToEvidence(null), null);
});

test("T9.3 (W44 Â· G3/320 Â· from 319_f3_promote Â§C): the promotion run-eval wires after a green M2 run stamps the emitted record; red leaves it byte-identical", async () => {
  const dir = mkdtempSync(join(tmpdir(), "rapidtool-runeval-t93-"));
  try {
    mkdirSync(join(dir, ".rapidtool"), { recursive: true });
    const recordPath = join(dir, ".rapidtool", "project.json");
    const base = createProject({ brief: "T9.3 promotion pin: a deterministic tiny brief for the run-eval seam." });
    writeFileSync(recordPath, JSON.stringify(base, null, 2), "utf8");
    /** @type {import("../src/lib/compile-check.server.ts").TreeRunOutcome} */
    const greenOutcome = {
      ok: true,
      dir,
      compile: { ok: true, dir, checked: 1, passed: 1, failed: 0, skipped: 0, verdicts: [] },
      tests: [
        { file: "tests/oracle.spec.ts", compile: "pass", run: "pass", tests: { pass: 1, fail: 0 }, detail: "1 passed" },
      ],
      run: { kind: "library", run: "skip", detail: "no entry to smoke" },
    };
    // The wire's own contract: the M2 evidence object accepts the additive
    // `minted` field (nothing frozen), and a green outcome promotes.
    const ev = treeRunToEvidence(greenOutcome);
    assert.ok(ev, "a green outcome maps to evidence");
    ev.minted = true;
    assert.equal(ev.minted, true, "the M2 evidence object accepts the promotion's additive `minted` field");
    const prom = await promoteEmittedTreeTested(base, dir, greenOutcome);
    assert.equal(prom.promoted, true, "a green run over the emitted dir promotes the dir's own record");
    const stamped = readFileSync(recordPath, "utf8");
    assert.match(stamped, /"label": "tested"/, "the emitted record carries the tested stamp");
    const red = await promoteEmittedTreeTested(base, dir, { ...greenOutcome, ok: false });
    assert.equal(red.promoted, false);
    assert.equal(readFileSync(recordPath, "utf8"), stamped, "a red run leaves the record byte-identical");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("(a) emitted trees on disk carry no grader content (leak scan over the real artifacts)", (t) => {
  const slugs = corpusSlugs();
  const present = slugs.filter((slug) => existsSync(join(OUT_DIR, slug)));
  if (present.length === 0) {
    t.skip("no emitted trees under research/eval-out yet â€” run `npm run eval` first");
    return;
  }
  for (const slug of present) {
    const g = loadGrader(slug);
    assert.ok(g.ok, `${slug}: ${g.ok ? "" : g.error}`);
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
  assert.ok(missing.error, "a missing grader must carry its skip reason");
  assert.match(missing.error, /SKIPPED/);
  assert.ok(missing.error.includes("definitely-not-a-case.grader.json"), "skip reason must name the missing grader");
  assert.equal(graderFileFor("x", GRADER_DIR).endsWith(join("graders", "x.grader.json")), true);
});

// 342-2 (W56): `passWhen.firstRun` is the per-run-kind corpus bar 342-3 declared
// in all 11 graders. The driver must CARRY it (validated) â€” a malformed block is
// refused, never silently dropped (a dropped bar would judge first runs at the
// warm bar and keep them capped at 8/9 by arithmetic).
test("342-2: parseGrader carries passWhen.firstRun, validated; a malformed block is a coded refusal", () => {
  const base = { slug: "s", acceptanceBar: "bar text", requiredIdentifiers: [], requiredCapabilities: [] };
  const good = parseGrader(
    JSON.stringify({ ...base, passWhen: { meanAtLeast: 1, firstRun: { meanAtLeast: 1, excludeCriteria: ["M7"], note: "n" } } }),
    "s",
  );
  assert.equal(good.ok, true);
  assert.deepEqual(good.grader.passWhen.firstRun, { meanAtLeast: 1, excludeCriteria: ["M7"] });
  assert.equal(good.grader.passWhen.meanAtLeast, 1, "the warm bar is unchanged by the firstRun block");
  // No block â†’ null (never a fabricated first-run bar).
  const none = parseGrader(JSON.stringify(base), "s");
  assert.equal(none.ok, true);
  assert.equal(none.grader.passWhen.firstRun, null);
  // Malformed blocks are coded refusals, NEVER silently dropped.
  const bad = [
    { meanAtLeast: 0, excludeCriteria: ["M7"] },
    { meanAtLeast: 1.5, excludeCriteria: ["M7"] },
    { meanAtLeast: "1", excludeCriteria: ["M7"] },
    { meanAtLeast: 1, excludeCriteria: "M7" },
    { meanAtLeast: 1, excludeCriteria: ["M11"] },
    { meanAtLeast: 1, excludeCriteria: [7] },
  ];
  for (const firstRun of bad) {
    const r = parseGrader(JSON.stringify({ ...base, passWhen: { meanAtLeast: 1, firstRun } }), "s");
    assert.equal(r.ok, false, `malformed firstRun must be refused: ${JSON.stringify(firstRun)}`);
    assert.ok(r.error, "the refusal must carry its reason");
    assert.match(r.error, /RT_E_VALIDATION/, "the refusal is coded");
  }
  assert.equal(parseGrader(JSON.stringify({ ...base, passWhen: { firstRun: "nope" } }), "s").ok, false);
});

test("342-2: every declared corpus firstRun bar reaches the parsed grader (declared â‡’ consumed)", () => {
  const dir = join(projectRoot(), "research", "eval-corpus", "graders");
  const files = readdirSync(dir).filter((f) => f.endsWith(".grader.json"));
  assert.equal(files.length, 11, "the corpus declares 11 graders");
  for (const f of files) {
    const slug = f.replace(/\.grader\.json$/, "");
    const g = loadGrader(slug);
    assert.equal(g.ok, true, `${slug}: ${g.ok ? "" : g.error}`);
    assert.deepEqual(
      g.grader.passWhen.firstRun,
      { meanAtLeast: 1, excludeCriteria: ["M7"] },
      `${slug}: the DECLARED firstRun bar must be parsed onto passWhen`,
    );
    assert.equal(g.grader.passWhen.meanAtLeast, 1, `${slug}: the warm bar is untouched`);
  }
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
  // Invalid records are null â€” never a fabricated 0:
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
  // 1 âˆ’ C(nâˆ’c,k)/C(n,k). Here n=2, c=1, k=2 â†’ 1 âˆ’ C(1,2)/C(2,2) = 1 (any draw
  // of 2 from 2 includes the single pass). The original 0.5 conflated pass@k
  // with the mean pass@1 â€” the implementation was right, the expectation wrong.
  assert.equal(flip.passAtK, 1);
  assert.equal(flip.passAllTrials, 0);

  const stableFail = trialsSummary([false, false, false], { k: 3 });
  assert.equal(stableFail.flaky, false, "no passes is a stable fail, not flaky");
  assert.equal(stableFail.passes, 0);
  assert.equal(stableFail.passAt1, 0);

  const oneTrial = trialsSummary([true], { k: 1 });
  assert.equal(oneTrial.flaky, false);
  assert.equal(oneTrial.flakinessMeasurable, false, "1 trial cannot measure flakiness");
  assert.ok(oneTrial.note, "a 1-trial run must say why flakiness is unmeasurable");
  assert.match(oneTrial.note, /1 trial/);
  assert.equal(oneTrial.passAt1, 1);

  const kTooBig = trialsSummary([true, false, true], { k: 5 });
  assert.equal(kTooBig.k, 5);
  assert.equal(kTooBig.kEffective, 3, "k clamps to the observed trial count");

  const empty = trialsSummary([], { k: 3 });
  assert.equal(empty.trials, 0);
  assert.equal(empty.passAt1, null);
  assert.equal(empty.flaky, null);

  // Only a literal `true` is a pass â€” no truthiness inflation.
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
// (finite mean â†’ mean threshold â†’ files â†’ content). The run-2 record (`pass:no`
// with filesOk+contentOk green and an EMPTY shortfall list) could not name its
// own cause, because the log line only listed missingFiles/failedContent.
// acceptanceFailReason names the FIRST false clause; it must stay clause-exact
// with passesAcceptance (same order, same leniency gate).
test("(b) acceptanceFailReason names the failing clause (mean threshold vs files/content)", () => {
  const grader = { passWhen: { meanAtLeast: 1, requireExpectedFiles: true, requireExpectedContent: true } };
  const okAcc = { filesOk: true, contentOk: true, missingFiles: [], failedContent: [] };
  // The exact run-2 shape: files+content green, 6/9 mean â†’ the ONLY false clause is the threshold.
  assert.equal(passesAcceptance({ mean: 0.6667 }, okAcc, grader), false);
  const belowThreshold = acceptanceFailReason({ mean: 0.6667 }, okAcc, grader);
  assert.ok(belowThreshold, "a below-threshold mean must name its clause");
  assert.match(belowThreshold, /mean 0\.6667 < 1/);
  assert.equal(acceptanceFailReason({ mean: 1 }, okAcc, grader), null, "green row has no reason");
  const crashed = acceptanceFailReason(null, okAcc, grader);
  assert.ok(crashed, "a crashed trial reports the mean clause");
  assert.match(crashed, /mean/);
  const missingFile = acceptanceFailReason({ mean: 1 }, { ...okAcc, filesOk: false, missingFiles: ["index.html"] }, grader);
  assert.ok(missingFile);
  assert.match(missingFile, /index\.html/);
  const missingContent = acceptanceFailReason(
    { mean: 1 },
    { ...okAcc, contentOk: false, failedContent: ['package.json: missing "test"'] },
    grader,
  );
  assert.ok(missingContent);
  assert.match(missingContent, /package\.json/);
  // Lenient grader: both assertion clauses are OFF â†’ no reason even when red.
  const lenient = { passWhen: { meanAtLeast: 0.5, requireExpectedFiles: false, requireExpectedContent: false } };
  assert.equal(acceptanceFailReason({ mean: 0.5556 }, { ...okAcc, filesOk: false, contentOk: false, missingFiles: ["x"], failedContent: ["y"] }, lenient), null);
});

// 342-2 (W56): the first-run bar is CONSUMED by the pass predicate. A first run
// cannot score M7 (no prior lesson), so its bar excludes M7 over the remaining
// eight â€” every one still required (mean 1 over 8 = all eight, not a lowered
// bar). A warm run keeps the full nine. No false green: the keyless floor and a
// warm card missing M7 both fail.
test("342-2: passesAcceptance selects the per-run-kind bar (first clears 8/9; warm still needs M7)", () => {
  const card = (scores) => ({
    criteria: Object.fromEntries(Object.entries(scores).map(([id, score]) => [id, { score, evidence: "342-2 test" }])),
    mean: Object.values(scores).reduce((a, b) => a + b, 0) / 9,
  });
  const eight = card({ M1: 1, M2: 1, M3: 1, M4: 1, M5: 1, M6: 1, M7: 0, M8: 1, M9: 1 }); // 8/9, M7 only zero
  const nine = card({ M1: 1, M2: 1, M3: 1, M4: 1, M5: 1, M6: 1, M7: 1, M8: 1, M9: 1 });
  const floor = card({ M1: 0, M2: 0, M3: 0, M4: 0, M5: 1, M6: 1, M7: 0, M8: 1, M9: 1 }); // keyless first row
  const grader = {
    passWhen: {
      meanAtLeast: 1,
      firstRun: { meanAtLeast: 1, excludeCriteria: ["M7"] },
      requireExpectedFiles: false,
      requireExpectedContent: false,
    },
  };
  const okAcc = { filesOk: true, contentOk: true, missingFiles: [], failedContent: [] };

  assert.equal(passesAcceptance({ ...eight, runKind: "first" }, okAcc, grader), true, "an 8/9 first run (M7 excluded) clears");
  assert.equal(passesAcceptance({ ...eight, runKind: "warm" }, okAcc, grader), false, "the SAME card warm still needs M7");
  assert.equal(passesAcceptance({ ...nine, runKind: "warm" }, okAcc, grader), true, "a warm 9/9 still passes");
  assert.equal(passesAcceptance({ ...floor, runKind: "first" }, okAcc, grader), false, "the keyless floor fails the first-run bar");
  assert.equal(passesAcceptance({ ...floor, runKind: "warm" }, okAcc, grader), false, "the keyless floor fails the warm bar");

  const reason = acceptanceFailReason({ ...floor, runKind: "first" }, okAcc, grader);
  assert.ok(reason);
  assert.match(reason, /first/, "the reason names the run kind");
  assert.match(reason, /M7/, "the reason names the excluded criterion");
});

// 342-2b (verifier A + B): an ABSENT or unknown `runKind` must be judged on the
// STRICTER warm bar (all nine) â€” never the lenient first-run bar. A legacy /
// synthetic re-judge of a warm row that carries a criteria map must not clear
// 8/9 by silently dropping M7.
test("342-2b: an absent/unknown runKind is judged on the warm bar (all nine), never the lenient first-run bar", () => {
  const card = (scores) => ({
    criteria: Object.fromEntries(Object.entries(scores).map(([id, score]) => [id, { score, evidence: "342-2b test" }])),
    mean: Object.values(scores).reduce((a, b) => a + b, 0) / 9,
  });
  const eight = card({ M1: 1, M2: 1, M3: 1, M4: 1, M5: 1, M6: 1, M7: 0, M8: 1, M9: 1 }); // 8/9, M7 only zero
  const grader = {
    passWhen: {
      meanAtLeast: 1,
      firstRun: { meanAtLeast: 1, excludeCriteria: ["M7"] },
      requireExpectedFiles: false,
      requireExpectedContent: false,
    },
  };
  const okAcc = { filesOk: true, contentOk: true, missingFiles: [], failedContent: [] };

  assert.equal(passesAcceptance({ ...eight, runKind: "first" }, okAcc, grader), true, "an explicit first run still clears 8/9");
  assert.equal(passesAcceptance({ ...eight, runKind: "warm" }, okAcc, grader), false, "warm still needs M7");
  assert.equal(passesAcceptance({ ...eight }, okAcc, grader), false, "an ABSENT runKind must not get the first-run bar");
  assert.equal(passesAcceptance({ ...eight, runKind: "bogus" }, okAcc, grader), false, "an UNKNOWN runKind is judged warm");
  const reason = acceptanceFailReason({ ...eight }, okAcc, grader);
  assert.ok(reason, "an 8/9 unknown-kind row must report a fail reason");
  assert.ok(!reason.includes("M7"), `an unknown kind is not a first run â€” no M7 exclusion claim (${reason})`);
});

// 342-2b (verifier B): the first-run exclusion list is ONE list â€”
// maker-score's FIRST_RUN_UNSCOREABLE_CRITERIA. The driver must refuse a graded
// bar that excludes a SCOREABLE criterion (a hollow first run could otherwise
// pass by dropping M1-M4). The 11 real graders exclude only M7.
test("342-2b: firstRun.excludeCriteria may name only the first-run-unscoreable criteria (M7)", () => {
  const base = { slug: "s", acceptanceBar: "bar text", requiredIdentifiers: [], requiredCapabilities: [] };
  const withExclude = (excludeCriteria) =>
    parseGrader(JSON.stringify({ ...base, passWhen: { meanAtLeast: 1, firstRun: { meanAtLeast: 1, excludeCriteria } } }), "s");
  assert.equal(withExclude(["M7"]).ok, true, "M7 is the first-run-unscoreable criterion");
  for (const bad of [["M1"], ["M1", "M2", "M3", "M4"], ["M7", "M8"], ["M11"], [7]]) {
    const r = withExclude(bad);
    assert.equal(r.ok, false, `a first-run bar may not exclude a scoreable criterion: ${JSON.stringify(bad)}`);
    assert.match(r.error, /RT_E_VALIDATION/, "the refusal is coded");
    assert.match(r.error, /M7/, "the refusal names the only legal exclusion");
  }
});

// 342-2b (verifier B): the driver consumes maker-score's shared bar helpers â€”
// one exclusion list, one mean comparison. This source pin makes those exports
// genuinely consumed (a re-implementation would drift while its own test stayed
// green).
test("342-2b: the driver imports maker-score's shared bar helpers (one list, one comparison)", () => {
  const src = readFileSync(join(projectRoot(), "scripts", "run-eval.mjs"), "utf8");
  const importLine = src.match(/import\s*\{[^}]*\}\s*from\s*"\.\.\/src\/lib\/maker-score\.ts"/s);
  assert.ok(importLine, "run-eval.mjs imports from maker-score.ts");
  assert.match(importLine[0], /\bmeetsRunKindBar\b/, "the shared comparison is imported, not re-implemented");
  assert.match(importLine[0], /\bFIRST_RUN_UNSCOREABLE_CRITERIA\b/, "the shared exclusion list is imported");
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
    ["no-grader", { ok: false, path: join(GRADER_DIR, "no-grader.grader.json"), error: "no run-side grader at X â€” case SKIPPED (never graded against an undeclared bar)" }],
  ]);
  const plan = planTargets(entries, (slug) => graders.get(slug));
  assert.deepEqual(plan.targets.map((t) => t.entry.slug), ["has-grader"]);
  assert.equal(plan.skips.length, 1);
  assert.equal(plan.skips[0].slug, "no-grader");
  assert.equal(plan.skips[0].kind, "no-grader");
  assert.match(plan.skips[0].reason, /SKIPPED/);
  assert.equal(plan.targets.some((t) => t.entry.slug === "no-grader"), false, "an ungraded case must not run");

  // â€¦and the skip lands in the persisted summary (honest accounting), while the
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
  // The legacy summary keys are produced by persist(), not here â€” but the
  // W5-L5 block must never redefine them either:
  assert.equal("entries" in summary, false);
  assert.equal("meanTotal" in summary, false);
});

test("(c) the recorded results.json keeps the legacy contract and adds W5-L5 keys", (t) => {
  const resultsPath = join(OUT_DIR, "results.json");
  if (!existsSync(resultsPath)) {
    t.skip("no research/eval-out/results.json yet â€” run `npm run eval` first");
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
// (d) fixes/237 â€” C-2 (`223` Â§4, `230` OV-5(a)): a hard-DoD stop is a CODED
// TERMINAL stop in the drain. Today the terminal set is {complete, blocked,
// error}, so a `dod` round (headless.ts:587-606 â€” a real hard stop) reads as
// "progress" and the drain re-enters the block for its full 80-round guard
// (~80 `dod.blocked` rows), then reports a SILENT `position:"stalled",
// onTime:false` â†’ M9=0. These two pins close that.
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

test("(d) the drain exits on the FIRST dod round with a coded stop (WB-2 â†’ M9)", async () => {
  // Same shape as `223` Â§C-2's scratch probe: a project COMPLETE at phase 1
  // with a red gate under enforceDod:true â€” runUntilGate returns outcome
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
  assert.ok(drain.res, "the drain must carry its terminal run result");
  assert.equal(drain.res.outcome, "dod", "the round really is the hard-DoD stop");
  assert.equal(drain.position, "dod", "a hard stop parks as its own coded position, never a silent stall");
  assert.equal(drain.onTime, true, "the drain stopped WITH a terminal state (M9's first branch)");
  assert.equal(drain.code, "RT_E_GATE_PENDING", "the stop carries the wild path's code for the same block (engine.ts:3571)");
  assert.match(String(drain.stall), /DoD unmet/, "the stall evidence is the hard-DoD message");
  const rowsAfter = (drain.p.logs ?? []).filter((l) => l.event === "dod.blocked").length;
  assert.equal(rowsAfter, 1, `exactly ONE drain round ran the hard-DoD block â€” got ${rowsAfter} (80 before this fix)`);
  assert.equal(drain.p.currentPhase, 1, "cursor unmoved â€” a hard stop advances nothing");
  assert.equal(drain.approved.length, 0, "no gate was approved on the way out");
});

test("342-2: drainPipeline threads researchLive to the research phase (keyless free search)", async () => {
  // The post-journey drain used to pass keyed:false only, so P7's live research
  // never ran (the harness gap). researchLive drives the KEYLESS bare-Node
  // overlay for research phases without keying the P8â€“P12 narratives.
  const savedKey = process.env.DEEPSEEK_API_KEY;
  const real = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("lite.duckduckgo.com")) {
      // The fixture must be ON-TOPIC for the project: W61 C9's relevance filter
      // (engine.filterRelevantResearch, applied by the headless overlay) drops a
      // result that shares no content term with the phase intent, the domain or
      // the project's vocabulary â€” the old "breakout paddle physics" snippet was
      // such a result and was correctly filtered out, which made this threading
      // test assert on an empty corpus.
      const target = encodeURIComponent("https://example.com/notes-app-research");
      return new Response(
        `<a href="//duckduckgo.com/l/?uddg=${target}">ResearchDrain notes app: competitors and market landscape</a>` +
          `<td class='result-snippet'>A real snippet about competitors, market landscape and search for a notes app.</td>`,
        { status: 200 },
      );
    }
    return new Response("", { status: 404 });
  };
  try {
    delete process.env.DEEPSEEK_API_KEY;

    const p7Ready = () => {
      const p = createProject({
        brief: "Build a small notes app with add/list/search and its own tests.",
        name: "ResearchDrain",
      });
      /** @type {Array<"complete"|"ready"|"locked">} */
      const statuses = Array.from({ length: 13 }, (_, id) =>
        id <= 6 ? "complete" : id === 7 ? "ready" : "locked",
      );
      p.currentPhase = 7;
      p.phases = p.phases.map((rec, id) => ({ ...rec, status: statuses[id] }));
      return p;
    };

    const withOpt = await drainPipeline(p7Ready(), { researchLive: true });
    assert.ok((withOpt.p.research?.length ?? 0) >= 1, "a research phase ran the live overlay");
    assert.equal(withOpt.p.research?.[0]?.provider, "duckduckgo", "the free keyless search served the finding");
    assert.ok(
      calls.every((u) => u.includes("duckduckgo")),
      `no LLM/other network call (saw: ${calls.join(", ")})`,
    );
    const without = await drainPipeline(p7Ready(), {});
    assert.equal(without.p.research?.length ?? 0, 0, "the default drain stays keyless â€” byte-identical");
  } finally {
    globalThis.fetch = real;
    if (savedKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = savedKey;
  }
});

// ---------------------------------------------------------------------------
// (e) OV-35 (fixes/244, W16-L1) â€” the Step-0 preflight: OV-27 reachability +
// failure-class triage + kill-safety run marker. The three clauses `235` Â§2
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
      assert.equal(s.marker.finishedAt, null, "the marker is UNFINISHED while entries run â€” a kill at any point leaves it so");
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
  /** @type {Array<[{configured?: boolean, wire?: {attempted?: boolean, ok?: boolean, httpStatus?: number|null, code?: string|null, error?: string|null, model?: string|null, requestedModel?: string|null}|null}, string, string]>} */
  const cases = [
    [{ configured: false }, "not-configured", "RT_E_LLM_NOT_CONFIGURED"],
    [
      { configured: true, wire: { attempted: true, ok: false, httpStatus: 401, code: "RT_E_LLM_REJECTED", error: "DeepSeek API key is invalid (HTTP 401)" } },
      "auth-rejected",
      "RT_E_LLM_REJECTED",
    ],
    [
      // W24/B2 (fixes/263): W23-L1 gave the vendor's balance class its OWN
      // class+code (`RT_E_LLM_NO_BALANCE` â€” never the session budget
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
  assert.equal(codes.size, 4, "the four demanded endings are CODE-distinct (235 Â§2 row 3)");
  // The request-rejected detail names the requested model id (D1.4's drift question):
  assert.match(classifyLlmPreflight(cases[3][0]).detail, /deepseek-v4-flash/);
  // The remaining endings classify too (no silent fallthrough):
  assert.equal(classifyLlmPreflight({ configured: true, wire: { attempted: true, ok: false, httpStatus: null, code: "RT_E_NETWORK_UNREACHABLE", error: "fetch failed" } }).class, "unreachable");
  assert.equal(classifyLlmPreflight({ configured: true, wire: { attempted: true, ok: false, httpStatus: null, code: "RT_E_LLM_TIMEOUT", error: "timed out" } }).class, "timeout");
  assert.equal(classifyLlmPreflight({ configured: true, wire: null }).class, "configured-unprobed");
  assert.equal(classifyLlmPreflight({ configured: true, wire: { attempted: true, ok: true, httpStatus: 200, model: "deepseek-v4-flash" } }).class, "wire-ok");
  const ok = classifyLlmPreflight({ configured: true, wire: { attempted: true, ok: true, httpStatus: 200 } });
  assert.equal(ok.code, null, "wire-ok is not a failure â€” no code");
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
  // The persisted summary schema is pinned by key set â€” no new fields may appear:
  assert.deepEqual(
    Object.keys(buildSummary([])).sort(),
    ["cases", "flakyCases", "graderLeaks", "passAtK", "skipped", "skips", "trials"],
    "buildSummary's key set is the contract; the keyless path must not gain fields",
  );
});

test("OV-35: a â‰¤4/9 outcome is routed to the named branch", () => {
  const low = keyedRunDecision({ mode: "keyed", meanOfNine: 3.5 });
  assert.equal(low.branch, "retrace-first");
  assert.ok(low.line, "the retrace-first branch must carry its line");
  assert.match(low.line, /re-trace/i);
  assert.match(low.line, /do not re-run/i, "the wording must name re-trace vs re-run");
  const edge = keyedRunDecision({ mode: "keyed", meanOfNine: 4 });
  assert.equal(edge.branch, "retrace-first", "exactly 4/9 is inside the branch");
  const band = keyedRunDecision({ mode: "keyed", meanOfNine: 5.5 });
  assert.equal(band.branch, "band-expected");
  assert.ok(band.line, "the band-expected branch must carry its line");
  assert.match(band.line, /log/i);
  const high = keyedRunDecision({ mode: "keyed", meanOfNine: 8 });
  assert.equal(high.branch, "above-prediction");
  const keyless = keyedRunDecision({ mode: "keyless", meanOfNine: 6 });
  assert.equal(keyless.branch, "n/a");
  assert.equal(keyless.line, null, "the rule is keyed-only â€” keyless stays byte-identical (no line)");
  const nan = keyedRunDecision({ mode: "keyed", meanOfNine: Number.NaN });
  assert.equal(nan.branch, "no-score");
});

test("OV-35: every drain ending and all seven RunOutcome values classify to a coded class", () => {
  // All seven RunOutcome values (headless.ts:527) â€” none may be silent:
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
  // An uncoded stall can never be silent either â€” it reports the emitter bug:
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
  // Park GENUINELY on a stock HITL gate (P4 â€” `autopilot:false` stops there),
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
    // 401 stub: the vendor answers, the key is refused â€” NO network in tests.
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
    assert.ok(probe.wire, "the 401 probe must record its wire attempt");
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
    assert.ok(probe2.wire, "the 200 probe must record its wire attempt");
    assert.equal(probe2.wire.httpStatus, 200);
    assert.equal(probe2.wire.model, "deepseek-v4-flash");
    // wire:false â†’ configured but UNPROBED (never a silent pass):
    const unprobed = await probeP6Reachability({ wire: false });
    assert.equal(unprobed.class, "configured-unprobed");
    assert.equal(unprobed.wire, null);
    // No key â†’ not-configured, wire skipped entirely:
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
    // The stale file is still on disk (the kill cannot remove it) â€” the marker
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
// (e) OV-7 (W19-L4) â€” corpus spread + grader FREEZE + the brief leak scan.
//
// The row's done-when: "M7 measurable across â‰¥2 domains; graders frozen and
// leak-scanned". These pins hold the three halves without running the (slow)
// eval pipeline; the row's own evidence run (`npm run eval -- --trials=2`) is
// the integration proof and lives in fixes/252_lane4_ov7.md.
// ---------------------------------------------------------------------------

test("OV-7: the corpus spans â‰¥2 domains and â‰¥2 of them carry â‰¥2 fixtures (a citable same-domain peer)", () => {
  const found = listCorpusEntries();
  const entries = found.filter((f) => f.entry !== null).map((f) => f.entry);
  assert.ok(entries.length >= 7, `expected the seven corpus fixtures, saw ${entries.length}`);
  const index = corpusDomainIndex(entries);
  const domains = Object.keys(index);
  assert.ok(domains.length >= 2, `the corpus must span â‰¥2 domains, saw ${domains.length}: ${domains.join(", ")}`);
  const multi = domains.filter((d) => index[d].length >= 2);
  assert.ok(
    multi.length >= 2,
    `expected â‰¥2 domains with â‰¥2 fixtures (the OV-7 expansion), saw ${multi.length}: ${JSON.stringify(index)}`,
  );
  // The domain the expansion targeted: construction had exactly one fixture
  // before this lane; its peer is permit-inspection-tracker.
  assert.ok((index.construction ?? []).length >= 2, `construction needs its second fixture: ${JSON.stringify(index.construction ?? [])}`);
  assert.ok((index["real-estate"] ?? []).length >= 2, `real-estate keeps its fixture set: ${JSON.stringify(index["real-estate"] ?? [])}`);
  // Trap guard (230 Â§OV-7): a domain's second fixture must not duplicate a brief.
  for (const d of multi) {
    const briefs = index[d].map((slug) => entries.find((e) => e.slug === slug)?.brief.trim() ?? "");
    assert.ok(briefs.every((b) => b.length > 0), `${d}: every fixture must carry a brief`);
    assert.equal(new Set(briefs).size, briefs.length, `${d}: fixture briefs must be distinct, not copies`);
  }
});

// ---------------------------------------------------------------------------
// FIX-2b (W44 window #4; D3's LEX root cause, fixes/321_d3_keyed_eval.md
// :159-176) â€” the arcade-breakout fixture brief must HIT the LEX register.
// The pre-rewrite brief scored 0 LEX hits â†’ `lattice.vague:true` â†’ scorecard
// `reframe:true` â†’ P0 forceHuman park â†’ the eval's autopilot seat honestly
// stalled (llmCalls 0). The rewritten brief keeps the SAME game intent and
// was proven KEYLESS (create + wild --start --steps 1, deterministic P0:
// C:/Users/mnril/f2b_probe/lexprobe323.sh â†’ outcome:"advanced", vague:false,
// verdict:"proceed", 0 reframe rows). This pin holds the LATTICE half
// mechanically through the driver's own corpus loader + the engine's own
// `intentLattice` (no second parser, no brief copy): a future edit that drops
// the LEX vocabulary â€” or silently drops the game nouns â€” turns THIS red
// before any keyed run spends a token on the guaranteed reframe park.
// ---------------------------------------------------------------------------
test("FIX-2b: the arcade-breakout fixture brief hits the LEX register (non-vague lattice) and keeps the game intent", () => {
  const found = listCorpusEntries();
  const entry = found.filter((f) => f.entry !== null).map((f) => f.entry).find((e) => e.slug === "arcade-breakout");
  assert.ok(entry, "the arcade-breakout fixture must exist in the corpus (README is documentation, not an entry)");
  const lat = intentLattice(entry.brief, entry.domain);
  assert.equal(
    lat.vague,
    false,
    `0 LEX hits â‡’ vague â‡’ scorecard reframe â‡’ P0 forceHuman park (the reframe the rewrite closes). jobs=${JSON.stringify(lat.jobs)} entities=${JSON.stringify(lat.entities)}`,
  );
  for (const job of ["drag", "track", "persist"]) {
    assert.ok(lat.jobs.includes(job), `the brief must register LEX job \`${job}\`: ${JSON.stringify(lat.jobs)}`);
  }
  assert.ok(lat.entities.includes("player"), `the brief must register LEX actor \`player\`: ${JSON.stringify(lat.entities)}`);
  // Intent guard: the LEX rewrite is additive vocabulary â€” every original game
  // noun the grader's identifiers/capabilities line back to stays present.
  for (const noun of ["paddle", "ball", "brick", "level", "speed", "score", "keyboard", "pause", "resume", "win", "lose", "canvas"]) {
    assert.ok(
      entry.brief.toLowerCase().includes(noun),
      `the rewrite must keep the original game intent â€” \`${noun}\` missing from: ${entry.brief}`,
    );
  }
  assert.equal(entry.kind, "game", "the declared kind stays `game` (the run-side grader's expectedKind)");
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
  // Control: a scan that cannot fail is not a scan â€” bake the bar into a
  // synthetic brief and it MUST be flagged (the playbook's named trap).
  const g = loadGrader("permit-inspection-tracker");
  assert.ok(g.ok, "the control grader must load");
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

test("OV-7: grader freeze â€” an untouched grader verifies ok; a mid-run edit is caught and named", () => {
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
    // Unchanged since the fingerprint â†’ the run is gradeable:
    const ok = verifyGraderFreeze([fp]);
    assert.deepEqual(ok, { checked: 1, ok: true, changed: [] });
    // Edited mid-run (the bar is weakened by one word) â†’ flagged with slug + hashes:
    writeFileSync(path, text.replace("original", "softened!!"), "utf8");
    const moved = verifyGraderFreeze([fp]);
    assert.equal(moved.ok, false);
    assert.equal(moved.changed.length, 1);
    assert.equal(moved.changed[0].slug, "frozen");
    assert.equal(moved.changed[0].reason, "bytes-changed-mid-run");
    assert.notEqual(moved.changed[0].hashAtStart, moved.changed[0].hashNow);
    // Deleted mid-run â†’ flagged as unreadable, never a throw:
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
  assert.equal(calls, entries.length, "one resolution per entry â€” the plan is the only load site");
  assert.equal(plan.targets.length, 3);
  assert.deepEqual(plan.skips, [], "every case with a grader is a target");
  for (const t of plan.targets) {
    assert.equal(t.grader.slug, t.entry.slug, "each target carries the PLAN-TIME grader object");
    assert.equal(typeof t.graderPath, "string", "the path rides the target â€” for the freeze fingerprint only");
  }
});

test("OV-7: M7 prior resolution â€” rows resolve per slug across domains; a first run is honestly null", () => {
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
    // Two domains, both resolvable â€” the prior exists in each:
    assert.deepEqual(priorFor("real-estate-crm", historyPath), { m1: 0, m2: 1, m3: 0 });
    assert.deepEqual(priorFor("field-ops-suite", historyPath), { m1: 0, m2: 0, m3: 0 });
    // A slug with no rows is null â€” "no prior same-domain run", never a fabricated 0/0/0:
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
// W24/B2 (fixes/263_lane2_periphery_bughunt.md) â€” the W23-L1 eval wires.
// Every fetch below is STUBBED: no request leaves the process, no keyed call.
// ---------------------------------------------------------------------------

/** A dummy credential for the stubbed-fetch calls. It can never reach the
 *  network: each provider call injects its own `fetch`. */
const W24_B2_DUMMY_KEY = "w24-b2-dummy-not-a-real-key";

test("W24/B2 â€” a THROWING tap never breaks the call it observes (deepseek.ts tapLlmCall)", async () => {
  const ds = await import("../src/lib/deepseek.server.ts");
  const savedKey = process.env.DEEPSEEK_API_KEY;
  // Keyless: the honest not-configured refusal still dispatches the tap, so the
  // guard is provable without any key, fetch or network.
  delete process.env.DEEPSEEK_API_KEY;
  ds.setLlmCallTap(() => {
    throw new Error("hostile tap â€” must never reach the caller");
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

test("W24/B2 â€” the provider call tap is WIRED: install â†’ window â†’ live record â†’ folded evidence", async () => {
  const ds = await import("../src/lib/deepseek.server.ts");
  const savedKey = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = W24_B2_DUMMY_KEY;
  try {
    // The driver's install must succeed against the real provider surfaceâ€¦
    assert.equal(await installLlmCallTap(), true, "the provider module must expose setLlmCallTap");
    assert.equal(llmCallTapIsInstalled(), true);
    // â€¦and the SAME module instance the keyed leg calls must then be observed.
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
    assert.equal(bodies.length, 1, "the stubbed fetch is the only transport â€” no network");
    assert.equal(res.ok, true);
    const records = endTrialCallTap();
    assert.equal(records.length, 1, "the installed tap must observe the call inside its window");
    assert.equal(records[0].ok, true);
    assert.equal(records[0].requestedModel, "deepseek-v4-flash");
    assert.equal(records[0].servedModel, "deepseek-flash", "the SERVED id is read back, never the requested alias");
    assert.equal(records[0].promptTokens, 11);
    assert.equal(records[0].completionTokens, 3);
    const ev = llmEvidenceFromCallRecords(records);
    assert.ok(ev, "a one-call window must fold to evidence");
    assert.deepEqual(ev.servedModels, ["deepseek-flash"]);
    assert.equal(ev.usage.totalTokens, 14);
    assert.equal(ev.llmCalls, 1);
    assert.equal(ev.failedCalls, 0);
    assert.equal(typeof ev.estimatedCostUsd, "number");
    assert.ok(ev.estimatedCostUsd !== null && ev.estimatedCostUsd > 0, "a measured call must never price at 0 (the B2-1 fabricated-zero trap)");
    // The window is per-trial: nothing leaks into the next one, and an empty
    // window is reported as OBSERVED-nothing (never upgraded into a bill claim).
    beginTrialCallTap();
    assert.deepEqual(endTrialCallTap(), []);
    const none = llmEvidenceFromCallRecords([]);
    assert.ok(none, "an empty window must still fold (the tap observed nothing â€” never null)");
    assert.equal(none.llmCalls, 0);
    assert.match(none.costBasis, /OBSERVED no calls/, "an empty window must not claim 'nothing billed'");
  } finally {
    if (savedKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = savedKey;
  }
});

test("W43/A5 â€” the cache fold (M4-09): split tap record â†’ usage.cachedPromptTokens; legacy â†’ key absent", async () => {
  const ds = await import("../src/lib/deepseek.server.ts");
  const savedKey = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = W24_B2_DUMMY_KEY;
  try {
    assert.equal(await installLlmCallTap(), true);
    // (a) the vendor response carries DeepSeek's exact cache-split keys â†’ the
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
    assert.ok(splitEv, "the split window must fold to evidence");
    assert.equal(splitEv.usage.promptTokens, 11, "the fold still measures the prompt total");
    assert.equal(splitEv.usage.totalTokens, 14);
    assert.equal(splitEv.usage.cachedPromptTokens, 9, "the read-side fold surfaces cache reads to the row");
    // (b) a legacy response with no cache keys â†’ the key stays ABSENT
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
    assert.equal("cachedPromptTokens" in legacyRecords[0], false, "no measured split â†’ no record key");
    const legacyEv = llmEvidenceFromCallRecords(legacyRecords);
    assert.ok(legacyEv, "the legacy window must fold to evidence");
    assert.equal("cachedPromptTokens" in legacyEv.usage, false, "absent stays absent â€” never a fabricated 0");
    // (c) a non-number cache field is not a report (hostile-shape fold guard).
    const hostileEv = llmEvidenceFromCallRecords([
      { ok: true, promptTokens: 5, completionTokens: 2, cachedPromptTokens: "9" },
    ]);
    assert.ok(hostileEv, "a hostile-shape window must still fold to evidence");
    assert.equal("cachedPromptTokens" in hostileEv.usage, false, "a string is not a measurement");
  } finally {
    if (savedKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = savedKey;
  }
});

test("W24/B2 â€” probeFundedness: 402 â‡’ funded:false Â· answered 200 â‡’ funded:true Â· keyless â‡’ unaskable", async () => {
  const savedKey = process.env.DEEPSEEK_API_KEY;
  try {
    // (a) keyless â€” unaskable by construction, ZERO network I/O.
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
    assert.equal(off.funded, null, "keyless is neither funded nor unfunded â€” it is unaskable");
    assert.equal(off.code, "RT_E_LLM_NOT_CONFIGURED");

    // (b) dummy key + HTTP 402 â‡’ funded:false, ONE attempt, cheapest call.
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
    assert.equal(bodies.length, 1, "402 is not retryable â€” exactly one attempt");
    assert.equal(bodies[0].max_tokens, 1, "the probe must be the cheapest possible call");
    assert.equal(p402.funded, false, "a broke wallet stops the scored trials");
    assert.equal(p402.class, "no-balance");
    assert.equal(p402.code, "RT_E_LLM_NO_BALANCE");
    assert.equal(p402.httpStatus, 402);
    assert.ok(!JSON.stringify(p402).includes(W24_B2_DUMMY_KEY), "the key VALUE never enters the result");
    const lines = formatFundednessLines(p402);
    assert.ok(lines.some((l) => l.includes("funded=false")));
    assert.ok(lines.some((l) => l.includes("NO-BALANCE")), "the ONE renderer must name the stop");

    // (c) an ANSWERED 200 whose 1-token window truncates to empty content â‡’
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
    assert.equal(p200.funded, true, "an answered 200 means the account paid â€” never read as a refusal");
  } finally {
    if (savedKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = savedKey;
  }
});

test("W24/B2 â€” WIRING GUARD: the tap install, the fold gate, the fundedness renderer and its skip row stay wired", () => {
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
  // â€¦and the shape it pushes is the one the summary records verbatim:
  const summary = buildSummary([], [
    { slug: null, kind: "account-unfunded", reason: "fundedness probe stopped the run: (RT_E_LLM_NO_BALANCE)" },
  ]);
  assert.equal(summary.skipped, 1);
  assert.equal(summary.skips[0].kind, "account-unfunded");
});

// ---------------------------------------------------------------------------
// W42Â·L1-E3 â€” the missing pins (U1 + Q4-b/c): the run-side evaluators that
// carried NO test coverage before this wave (`git show 4af061a --stat` has no
// test-file pin; `grep -l "entry-runs|evaluateEntryRunsRow|checkExpectedBehavior"
// scripts/run-eval.test.mjs` was 0 hits). All keyless, all bounded:
//   (1) evaluateEntryRunsRow REAL evaluation, driven through the exported
//       checkExpectedBehavior / checkAcceptance seams: temp JS entries are
//       spawned for real â€” exit 0 within budget passes; exit 1 fails and the
//       row's detail carries the exit code;
//   (2) acceptanceFailReason rides the failed row's own coded detail
//       (â‰¤120 chars â€” a noisy child cannot bloat the record);
//   (3) historyEndClass tri-state (funded / unfunded / unmeasured);
//   (4) WIRING GUARD for E-1 (entries rows + crash row carry endClass).
// ---------------------------------------------------------------------------

/** Minimal grader for the behavior seams â€” only `expectedBehavior` matters. */
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

test("L1-E3(1) â€” evaluateEntryRunsRow REALLY runs the emitted entry: exit-0 passes, exit-1 fails with the coded detail", () => {
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
    assert.ok(okRow, "the passing row must be present");
    assert.equal(okRow.status, "pass", "an exit-0 entry within budget passes â€” a REAL bounded spawn, not a structural skip");
    assert.match(okRow.detail, /exit 0 in \d+ms/);
    assert.ok(badRow, "the failing row must be present");
    assert.equal(badRow.status, "fail", "a broken artifact FAILS the row â€” never a silent pass");
    assert.match(badRow.detail, /exit 1 â‰  declared exit 0/);
    assert.match(badRow.detail, /exec of broken-entry\.mjs/);
    assert.equal(behavior.ok, false);

    // The same verdict rides the acceptance record â€” `behaviorOk:false`, the
    // clause passesAcceptance ANDs â€” and the coded reason names the row's own
    // exit code (Q4-b tail).
    const acceptance = checkAcceptance(grader, dir, files);
    assert.equal(acceptance.behaviorOk, false);
    assert.equal(acceptance.behavior.rows.length, 2);
    const reason = acceptanceFailReason({ mean: 9 }, acceptance, grader);
    assert.ok(reason, "an expected-behavior failure must carry its reason");
    assert.match(reason, /expected behavior failed: e-bad/);
    assert.match(reason, /exit 1/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("L1-E3(2) â€” acceptanceFailReason carries the failed row's own coded detail, bounded at 120 chars", () => {
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
        { id: "r1", check: "entry-runs", entry: "cli.js", status: "fail", detail: "exit 7 â‰  declared exit 0 (exec of cli.js)" },
      ],
    },
  };
  const reason = acceptanceFailReason({ mean: 5 }, acceptance, grader);
  assert.ok(reason, "the failed row must carry its reason");
  assert.match(reason, /expected behavior failed: r1/);
  assert.match(reason, /\(cli\.js\)/, "the row's location rides the reason");
  assert.match(reason, /exit 7 â‰  declared exit 0/, "the row's OWN coded detail rides the reason (Q4-b tail)");

  const huge = "X".repeat(500);
  const noisy = acceptanceFailReason(
    { mean: 5 },
    { behaviorOk: false, behavior: { rows: [{ id: "r2", status: "fail", detail: huge }] } },
    grader,
  );
  assert.ok(noisy, "a capped detail must still produce a reason");
  assert.ok(noisy.includes("X".repeat(120)), "the detail keeps its first 120 chars");
  assert.ok(!noisy.includes("X".repeat(121)), "and is bounded at 120 â€” a noisy child cannot bloat the record");
});

test("L1-E3(3) â€” historyEndClass tri-state: unfunded wins, funded needs a scored keyed verdict, else unmeasured", () => {
  assert.equal(historyEndClass({ notes: { noBalance: true } }, "keyed"), "unfunded", "a broke wallet is never a measurement");
  assert.equal(historyEndClass({ notes: {}, acceptance: { pass: true } }, "keyed"), "funded");
  assert.equal(historyEndClass({ notes: {}, acceptance: { pass: false } }, "keyed"), "funded", "a scored FAIL is still a paid measurement");
  assert.equal(historyEndClass({ notes: {}, acceptance: { pass: true } }, "keyless"), "unmeasured", "keyless is the floor â€” no wallet was involved");
  assert.equal(historyEndClass({ notes: {} }, "keyed"), "unmeasured", "no verdict â†’ unmeasured");
  assert.equal(historyEndClass({}, "keyed"), "unmeasured", "a row without acceptance/notes never throws");
  assert.equal(historyEndClass(null, "keyed"), "unmeasured", "a missing row never throws");
  // E-1's seam: the class is computed from `acceptance` + `notes.noBalance` â€”
  // the two keys every entries row carries at classification time. A synthetic
  // entries-shaped row classifies exactly like the trial rows persist() records.
  const entryLike = { acceptance: { pass: false }, notes: { noBalance: false } };
  assert.equal(historyEndClass(entryLike, "keyed"), "funded");
  assert.equal(historyEndClass(entryLike, "keyless"), "unmeasured");
});

/** A fully-shaped entries/trial row for the real `persist()` writer (B1-F10). */
function persistedRow(over = {}) {
  const criteria = Object.fromEntries(["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9"].map((m) => [m, { score: 1, evidence: "pin" }]));
  return {
    slug: "pin-case",
    name: "Pin Case",
    domain: "custom-software",
    domainMatch: null,
    kind: "app",
    status: "ok",
    mode: "keyless",
    criteria,
    total: 9,
    mean: 1,
    baseline: null,
    coverage: { covered: {}, missing: [] },
    trials: trialsSummary([true], { k: 1 }),
    grader: null,
    perTrial: [],
    notes: {},
    ...over,
  };
}

test("L1-E3(4) â€” the persisted history rows carry a REAL endClass (computed, never fabricated)", () => {
  // B1-F10: the pre-fix leg matched two source lines. This calls the REAL
  // `persist()` writer against a scratch out-dir and reads what it wrote: the
  // history row's endClass is DERIVED from the row (a no-balance row is
  // "unfunded", an unscored keyless row is "unmeasured"), and the crash-fallback
  // row shape classes as "unmeasured" under both modes so a crash can never be
  // read as a funded measurement.
  const dir = mkdtempSync(join(tmpdir(), "run-eval-endclass-"));
  try {
    const paths = { outDir: dir, resultsPath: join(dir, "results.json"), historyPath: join(dir, "history.json") };
    const results = persist(
      [
        { entryRow: persistedRow({ slug: "scored", notes: { noBalance: true } }), card: null, trialRows: [] },
        { entryRow: persistedRow({ slug: "unscored" }), card: null, trialRows: [] },
      ],
      "keyless",
      [],
      {},
      paths,
    );
    assert.equal(results.entries.length, 2, "the entries array carries one entryRow per case");
    const history = JSON.parse(readFileSync(paths.historyPath, "utf8"));
    const byslug = Object.fromEntries(history.map((h) => [h.slug, h]));
    assert.equal(byslug["scored"].endClass, "unfunded", "a no-balance row classes unfunded (the wallet refused â€” not a measurement)");
    assert.equal(byslug["unscored"].endClass, "unmeasured", "an unscored keyless row classes unmeasured");
    for (const mode of ["keyed", "keyless"]) {
      assert.equal(historyEndClass({ notes: { error: "boom", trialsCrashed: true } }, mode), "unmeasured", `${mode}: the crash row is unmeasured`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// W42Â·L1-E6 â€” run-eval hygiene cluster pins (atomic writes, bounded history).
// ---------------------------------------------------------------------------

test("L1-E6(a) â€” writeJsonAtomic: atomic replacement, no tmp leftovers, and a failed rename never clobbers the old target", () => {
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
    // directory fails (EPERM on this host; EISDIR/ENOTDIR elsewhere) â€” the OLD
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

test("L1-E6(b) â€” MAX_HISTORY_ROWS pins the append bound + the persist slice wiring", () => {
  assert.equal(MAX_HISTORY_ROWS, 200, "the bound is 200 rows");
  // Slice semantics: the NEWEST rows survive (this run's included) and the
  // kept count never exceeds the cap.
  const rows = Array.from({ length: 260 }, (_, i) => i);
  const kept = rows.slice(-MAX_HISTORY_ROWS);
  assert.equal(kept.length, MAX_HISTORY_ROWS);
  assert.equal(kept[kept.length - 1], 259, "the newest (this run's) row is kept");
  assert.ok(!kept.includes(0), "the oldest rows are the ones dropped");
  // B1-F10 â€” behavioural, via the REAL `persist()` writer: an over-long
  // history is CAPPED at MAX_HISTORY_ROWS before the write, and neither write
  // leaves a `.tmp` behind (the atomic same-dir rename).
  const dir = mkdtempSync(join(tmpdir(), "run-eval-history-cap-"));
  try {
    const paths = { outDir: dir, resultsPath: join(dir, "results.json"), historyPath: join(dir, "history.json") };
    writeFileSync(paths.historyPath, JSON.stringify(Array.from({ length: 260 }, (_, i) => ({ at: "old", slug: `s${i}` }))), "utf8");
    persist([{ entryRow: persistedRow({ slug: "newest" }), card: null, trialRows: [] }], "keyless", [], {}, paths);
    const history = JSON.parse(readFileSync(paths.historyPath, "utf8"));
    assert.equal(history.length, MAX_HISTORY_ROWS, "history.json is capped at MAX_HISTORY_ROWS rows");
    assert.equal(history[history.length - 1].slug, "newest", "the newest (this run's) row survives the cap");
    assert.ok(!history.some((h) => h.slug === "s0"), "the oldest rows are the ones dropped");
    assert.ok(existsSync(paths.resultsPath), "results.json was written by the same call");
    assert.deepEqual(
      readdirSync(dir).filter((n) => n.endsWith(".tmp")),
      [],
      "both writes are atomic â€” a failed/partial write would leave a .tmp",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// W44 Â· T5.4 (fixes/318_a1_oracle.md) â€” the eval driver's bounded run-level
// telemetry: catalogue-legal rows only (the guardrail refuses invented
// names), host "cli", scope "eval-run", written where resolveLogDir points.
// ---------------------------------------------------------------------------

test("T5.4 â€” emitEvalRunRow writes catalogue-legal eval-run rows and refuses an invented name", () => {
  const dir = mkdtempSync(join(tmpdir(), "eval-rt-"));
  const saved = process.env.RAPIDTOOL_LOG_DIR;
  process.env.RAPIDTOOL_LOG_DIR = dir;
  try {
    emitEvalRunRow({
      level: "info",
      scope: "eval-run",
      event: "eval.run_start",
      message: "t5.4 pin Â· start",
      capture: "run-eval.test.mjs:0",
      payload: { mode: "keyless", targets: 1 },
    });
    emitEvalRunRow({ level: "info", scope: "eval-run", event: "eval.invented", message: "must be refused", capture: "run-eval.test.mjs:0" });
    const file = join(dir, "rapidtool.ndjson");
    assert.ok(existsSync(file), "the legal row must land in resolveLogDir's file");
    const rows = readFileSync(file, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    assert.equal(rows.length, 1, "exactly one row â€” the invented name is refused, never fabricated");
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

test("T5.4 wiring guard â€” the driver's bounded emit sites + the guardrail are in the source", () => {
  const src = readFileSync(new URL("./run-eval.mjs", import.meta.url), "utf8");
  assert.match(src, /if \(!seed \|\| !isKnownRtEvent\(seed\.event\)\) return;/, "the emitter refuses unknown names");
  assert.match(src, /event: "eval\.run_start"/, "a run-start row");
  assert.match(src, /event: "eval\.run_end"/, "run-end rows (main + empty-corpus paths)");
  assert.match(src, /event: "eval\.run_error"/, "the top-catch crash row");
  const emits = src.match(/emitEvalRunRow\(\{/g) ?? [];
  assert.equal(emits.length, 4, `the bounded set: start + end(main) + end(empty) + error â€” got ${emits.length}`);
});

// ---------------------------------------------------------------------------
// W44 A5 (fixes/325_a5_hunt.md B2) â€” the empty-corpus `results.json` writer
// was a bare writeFileSync (truncate-then-write: a kill mid-write tears the
// file) AND omitted the legacy `corpusDir` key that persist() always writes
// and the scorecard reader reads (`src/lib/scorecard.ts:284`; the recording
// writer contract above sits at line ~557). This leg pins the fix at the
// source (writeJsonAtomic + corpusDir, no bare writeFileSync in the block)
// AND behaviorally: a REAL keyless empty-corpus spawn whose recorded shape
// restores the legacy contract with no tmp residue beside the atomic write.
// ---------------------------------------------------------------------------
test("W44 A5 â€” the empty-corpus results.json writer is atomic and keeps the legacy corpusDir key (no tmp residue)", () => {
  // (a) source slice: the empty-corpus block must write atomically, carry
  // corpusDir, and never regress to a bare writeFileSync (the tear class).
  const src = readFileSync(new URL("./run-eval.mjs", import.meta.url), "utf8");
  const start = src.indexOf("if (entries.length === 0) {");
  const end = src.indexOf("process.exit(0);", start);
  assert.ok(start !== -1 && end > start, "the empty-corpus block boundaries were not found in run-eval.mjs");
  const block = src.slice(start, end);
  assert.match(block, /writeJsonAtomic\(RESULTS_PATH, \{/, "the empty-corpus results.json must persist atomically (writeJsonAtomic)");
  assert.match(block, /corpusDir:\s*CORPUS_DIR/, "the empty-corpus shape must keep the legacy corpusDir key");
  assert.ok(
    !/writeFileSync\(/.test(block),
    "a bare writeFileSync is back in the empty-corpus writer â€” a kill mid-write tears results.json",
  );

  // (b) behavioral spawn: a REAL keyless run over an empty corpus dir.
  const dir = mkdtempSync(join(tmpdir(), "rapidtool-a5-eval-empty-"));
  const corpus = join(dir, "emptycorpus");
  const out = join(dir, "out");
  mkdirSync(corpus, { recursive: true });
  try {
    /** @type {Record<string, string | undefined>} */
    const env = { ...process.env, EVAL_CORPUS_DIR: corpus, EVAL_OUT_DIR: out };
    delete env.DEEPSEEK_API_KEY;
    const res = spawnSync(
      process.execPath,
      ["--experimental-strip-types", fileURLToPath(new URL("./run-eval.mjs", import.meta.url))],
      { cwd: dir, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(res.status, 0, `an empty-corpus run is data: exit 0.\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
    const resultsPath = join(out, "results.json");
    assert.ok(existsSync(resultsPath), "the empty-corpus run must record results.json");
    const doc = JSON.parse(readFileSync(resultsPath, "utf8"));
    // The legacy contract restored: generatedAt / mode / corpusDir / graderDir /
    // entries / summary (the pre-fix bytes omitted corpusDir entirely).
    assert.equal(typeof doc.generatedAt, "string");
    assert.equal(doc.mode, "keyless");
    assert.equal(doc.corpusDir, resolve(corpus), "corpusDir must record the corpus the run walked");
    assert.equal(typeof doc.graderDir, "string");
    assert.ok(Array.isArray(doc.entries));
    assert.equal(doc.entries.length, 0);
    assert.equal(doc.summary.entries, 0);
    // Atomic discipline: the same-dir tmp file was renamed away â€” nothing but
    // results.json may sit beside it (a stray tmp = the tear window is back).
    const strays = readdirSync(out).filter((f) => f !== "results.json");
    assert.deepEqual(strays, [], `no tmp/half-written residue may remain beside results.json â€” got: ${strays.join(", ")}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// W50 Â· 336-4 (Switchboard) â€” the eval OUT_DIR safety guard. `npm run eval`
// used to default OUT_DIR to the TRACKED research/eval-out/** and rewrite it in
// place, so the scorecard could not be produced without dirtying the tree.
// `evalOutRefusal` refuses an UN-CHOSEN in-repo OUT_DIR and allows an explicit
// `--out`/EVAL_OUT_DIR (including the tracked dir on purpose). The pure decision
// is RED-first: before the guard existed this export (and the call) were absent.
// ---------------------------------------------------------------------------
test("W50 336-4 â€” evalOutRefusal refuses an un-chosen in-repo OUT_DIR and allows explicit/outside", () => {
  const tracked = join(ROOT, "research", "eval-out");
  const refusal = evalOutRefusal(tracked, { explicit: false, repoRoot: ROOT });
  assert.ok(refusal && typeof refusal.message === "string" && refusal.code === "RT_E_VALIDATION");
  assert.match(refusal.message, /git status/, "the refusal names the dirty-tree consequence");
  assert.match(refusal.message, /--out/, "the refusal names the --out remedy");
  assert.match(refusal.message, /EVAL_OUT_DIR/, "the refusal names the env remedy");
  // An EXPLICIT choice of the same tracked dir is allowed â€” the guard refuses
  // surprise, not intent (regenerating the tracked scorecard is a real action).
  assert.equal(evalOutRefusal(tracked, { explicit: true, repoRoot: ROOT }), null);
  // A dir OUTSIDE the repo needs no opt-in, even without explicit naming.
  assert.equal(evalOutRefusal(join(tmpdir(), "rapidtool-eval-out"), { explicit: false, repoRoot: ROOT }), null);
  // A sibling sharing a name prefix is NOT inside the repo (relative() must be used).
  assert.equal(evalOutRefusal(`${ROOT}-sibling`, { explicit: false, repoRoot: ROOT }), null);
});

test("W50 336-4 â€” `--out` directs the artifacts and WINS over EVAL_OUT_DIR (env dir stays empty)", () => {
  const dir = mkdtempSync(join(tmpdir(), "rapidtool-3364-out-"));
  const corpus = join(dir, "emptycorpus");
  const envOut = join(dir, "env-out");
  const argOut = join(dir, "arg-out");
  mkdirSync(corpus, { recursive: true });
  try {
    /** @type {Record<string, string | undefined>} */
    const env = { ...process.env, EVAL_CORPUS_DIR: corpus, EVAL_OUT_DIR: envOut };
    delete env.DEEPSEEK_API_KEY;
    const res = spawnSync(
      process.execPath,
      ["--experimental-strip-types", fileURLToPath(new URL("./run-eval.mjs", import.meta.url)), `--out=${argOut}`],
      { cwd: dir, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(res.status, 0, `--out must run: exit 0.\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
    assert.ok(existsSync(join(argOut, "results.json")), "--out=<dir> must receive results.json");
    assert.equal(
      existsSync(join(envOut, "results.json")),
      false,
      "--out must WIN over EVAL_OUT_DIR â€” the env dir must stay empty",
    );
    assert.match(res.stdout, /out: .*(arg-out)/, "the run names the effective out dir it used");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("W50 336-4 â€” main() invokes the OUT_DIR guard before any write (source pin)", () => {
  const src = readFileSync(new URL("./run-eval.mjs", import.meta.url), "utf8");
  assert.match(src, /const outRefusal = evalOutRefusal\(OUT_DIR, \{ explicit: OUT_EXPLICIT \}\);/);
  assert.match(src, /console\.error\(outRefusal\.message\);\s*\n\s*process\.exit\(2\);/);
  // --out is parsed (and beats the env) before OUT_DIR is computed.
  assert.match(src, /const OUT_ARG = /);
  assert.match(src, /const OUT_DIR = OUT_ARG !== null \? resolve\(OUT_ARG\) : process\.env\.EVAL_OUT_DIR/);
});


// ---------------------------------------------------------------------------
// W359 (resolve-kind) â€” the driver's corpus-kind bridge, and the ABSENCE of a
// second resolver.
//
// The mapper this replaces routed `library`/`service`/`""` to `undefined`: the
// driver stamped "no kind" while codegen still routed those fixtures down the
// library path, so the corpus could not tell a correct `service` emission from
// a masked one. The pin below is the mask itself: every corpus entry resolves to
// a LEGAL kind, and the declared contract words survive the bridge verbatim.
// ---------------------------------------------------------------------------
test("W359: the corpus-kind bridge is a vocabulary map, never a resolver", () => {
  assert.equal(declaredCorpusKind("webapp"), "app");
  assert.equal(declaredCorpusKind("app"), "app");
  assert.equal(declaredCorpusKind("game"), "game");
  assert.equal(declaredCorpusKind("tool"), "tool");
  assert.equal(declaredCorpusKind("cli-tool"), "tool");
  // THE MASK W359 REMOVES: these two used to become `undefined`.
  assert.equal(declaredCorpusKind("library"), "library");
  assert.equal(declaredCorpusKind("service"), "service");
  // Case/space normalisation, and an unknown word is NOT invented into a kind.
  assert.equal(declaredCorpusKind(" WebApp "), "app");
  assert.equal(declaredCorpusKind(""), null);
  assert.equal(declaredCorpusKind(undefined), null);
  assert.equal(declaredCorpusKind("desktop-app"), null);
});

test("W359: every corpus fixture resolves to a legal kind (no entry is left kind-less)", () => {
  const entries = listCorpusEntries().map((r) => r.entry).filter((e) => e !== null);
  assert.ok(entries.length > 0, "the tracked corpus is readable");
  const legal = new Set(["app", "tool", "game", "library", "service"]);
  for (const entry of entries) {
    const kind = projectKindForEntry(entry);
    assert.ok(legal.has(kind), `${entry.slug}: resolves to the legal kind ${kind}`);
    assert.equal(kind, declaredCorpusKind(entry.kind), `${entry.slug}: the declared contract word decides`);
  }
  // The two the old mapper swallowed keep their declared contract (the library/
  // service fixtures are exactly the ones the corpus could not measure).
  const bySlug = new Map(entries.map((e) => [e.slug, e]));
  assert.equal(projectKindForEntry(bySlug.get("date-rrule-library")), "library");
  assert.equal(projectKindForEntry(bySlug.get("order-webhook-service")), "service");
  assert.equal(projectKindForEntry(bySlug.get("arcade-breakout")), "game");
  assert.equal(projectKindForEntry(bySlug.get("showing-booking")), "app");
});

test("W359: the driver imports the ONE decision and carries no local resolver", () => {
  const src = readFileSync(new URL("./run-eval.mjs", import.meta.url), "utf8");
  assert.match(src, /import \{ deliveryKindOf \} from "\.\.\/src\/lib\/engine\.ts"/);
  assert.equal(/function deliveryKindOf\(corpusKind\)/.test(src), false, "the local resolver is gone");
  assert.equal(/default:\s*\n\s*return undefined; \/\/ library/.test(src), false, "the mask is gone");
  // The project is built WITH the resolved kind (never a conditional `...(kind ? â€¦)`).
  assert.match(src, /const kind = projectKindForEntry\(entry\);/);
  assert.match(src, /createProject\(\{ brief: entry\.brief, name: entry\.name, kind \}\)/);
});
