// ---------------------------------------------------------------------------
// gate-invariants.test.mjs — P-B seam pins + the static-guard fired-on-
// historical proofs (C-05, C-12, C-14, C-16, C-18 + C-01/C-02/C-03/C-09/C-11).
//
// Two kinds of assertion live here:
//
//   1. SEAM PINS — import the REAL fixer exports (read-only) and assert the
//      corrected behaviour on the REAL historical fixture. Where the owning
//      lane has not landed the fix, the pin is deliberately RED and its message
//      names the lane + the pending interface. A red pin is the interface; this
//      file never edits a fixer's file.
//
//   2. STATIC PROOFS — spawn the P-B static guards (tree-invariants,
//      readme-parity, runlock-preflight) over the historical trees, and over
//      scratch copies repaired with the real fix, proving each guard FIRES on
//      the defect and PASSES on the repair.
//
// Run: node --test --test-reporter=tap scripts/guards/*.test.mjs
// ---------------------------------------------------------------------------
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { specSourceHasBehaviouralAssert } from "../../src/lib/compile-check.server.ts";
import { deliveryKindOf, deepenResearch, inferDomain, inferName } from "../../src/lib/engine.ts";
import { DOD, archProductComplete, archTrace } from "../../src/lib/dod.ts";
import * as headless from "../../src/lib/headless.ts";
import { PARITY_ALLOWLIST } from "./readme-parity.mjs";
import { normalizeMtimes, preflight } from "./runlock-preflight.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const GUARDS = join(ROOT, "scripts", "guards");
// B1-F1: the run root is the TRACKED in-repo fixture subset (`<repo>/testruns`),
// so this suite is green on a clean checkout; `RAPIDTOOL_TESTRUNS` still
// overrides for a host that keeps a larger run root elsewhere.
const TESTRUNS = process.env.RAPIDTOOL_TESTRUNS || join(ROOT, "testruns");

function read(file) {
  return readFileSync(file, "utf8");
}

function runGuard(script, args) {
  const env = { ...process.env };
  delete env.DEEPSEEK_API_KEY;
  delete env.NODE_TEST_CONTEXT;
  const res = spawnSync(process.execPath, [join(GUARDS, script), ...args], { cwd: ROOT, env, encoding: "utf8", timeout: 120_000 });
  if (res.error) throw res.error;
  return { status: res.status, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
}

function withScratch(fn) {
  const dir = mkdtempSync(join(tmpdir(), "rt-guard-pin-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Copy an emitted tree's sources only — never node_modules/.git (huge, irrelevant to a static scan). */
function copyTree(source, dest) {
  cpSync(source, dest, {
    recursive: true,
    filter: (src) => !/(^|[\\/])(node_modules|\.git|dist|build|coverage|\.output)$/.test(src),
  });
}

/** How many keyed-synthesis log rows a persisted project carries. */
function synthesisRowsOf(project) {
  return (project.logs ?? []).filter((l) => String(l && l.event).startsWith("p6.synthesis.")).length;
}

/**
 * The GENUINE keyless floor for a persisted project: the real bytes with every
 * `p6.synthesis.*` row removed and an absent tree, materialized as a real fixture
 * and read back through the real loader. `{...project, generatedTree: []}` is NOT
 * the keyless floor when the fixture's own logs already carry a keyed attempt —
 * the fail-closed `p6-arch` probe then returns `false` for the control too, which
 * is exactly why the C-14 pin was unsatisfiable.
 */
function buildKeylessFloor(project) {
  const logs = (project.logs ?? []).filter((l) => !String(l && l.event).startsWith("p6.synthesis."));
  return withScratch((dir) => {
    const p = join(dir, "build.json");
    writeFileSync(p, JSON.stringify({ ...project, generatedTree: [], logs }));
    return headless.loadProject(p);
  });
}

// --- static guards: fired-on-historical + repaired-control proofs ------------

test("C-01 tree-invariants: fires on the 2-file historical tree, passes on a repaired copy", () => {
  const historical = runGuard("tree-invariants.mjs", ["--trees", join(TESTRUNS, "office-scheduler", "emitted"), "--only", "underproduction"]);
  assert.equal(historical.status, 1, `under-production guard must FIRE on office-scheduler: ${historical.stdout}${historical.stderr}`);
  assert.match(historical.stdout, /RT_E_PLAN_UNDERPRODUCED/);
  withScratch((dir) => {
    const copy = join(dir, "emitted");
    copyTree(join(TESTRUNS, "office-scheduler", "emitted"), copy);
    const projectPath = join(copy, ".rapidtool", "project.json");
    const project = JSON.parse(read(projectPath));
    const jobs = ["approve", "schedule", "assign", "scan", "sync"];
    mkdirSync(join(copy, "src", "jobs"), { recursive: true });
    for (const job of jobs) {
      writeFileSync(join(copy, "src", "jobs", `${job}.ts`), `export function ${job}(): number {\n  return 0;\n}\n`);
      project.generatedTree.push({ path: `src/jobs/${job}.ts`, source: `export function ${job}(): number {\n  return 0;\n}\n` });
    }
    writeFileSync(projectPath, JSON.stringify(project));
    const repaired = runGuard("tree-invariants.mjs", ["--trees", copy, "--only", "underproduction"]);
    assert.equal(repaired.status, 0, `repaired copy must PASS: ${repaired.stdout}${repaired.stderr}`);
  });
});

test("C-02 tree-invariants: fires on the TS2308 barrel collision, passes after the dedupe repair", () => {
  const historical = runGuard("tree-invariants.mjs", ["--trees", join(TESTRUNS, "bakery-florist-orders", "emitted"), "--only", "duplicate-export"]);
  assert.equal(historical.status, 1, `duplicate-export guard must FIRE on bakery-florist-orders: ${historical.stdout}`);
  assert.match(historical.stdout, /getDailyRevenueByCategory/);
  withScratch((dir) => {
    const copy = join(dir, "emitted");
    copyTree(join(TESTRUNS, "bakery-florist-orders", "emitted"), copy);
    const file = join(copy, "src", "generated", "get-daily-revenue-by.ts");
    const kept = read(file).split("\n").filter((line) => !/^export \{ getDailyRevenueByCategory/.test(line));
    writeFileSync(file, kept.join("\n"));
    const repaired = runGuard("tree-invariants.mjs", ["--trees", copy, "--only", "duplicate-export"]);
    assert.equal(repaired.status, 0, `deduped copy must PASS: ${repaired.stdout}${repaired.stderr}`);
  });
});

test("C-03 tree-invariants: fires on the globalThisStore TDZ, passes after the hoist repair", () => {
  const historical = runGuard("tree-invariants.mjs", ["--trees", join(TESTRUNS, "mobile-companion", "emitted"), "--only", "use-before-declaration"]);
  assert.equal(historical.status, 1, `use-before-decl guard must FIRE on mobile-companion: ${historical.stdout}`);
  assert.match(historical.stdout, /globalThisStore/);
  withScratch((dir) => {
    const copy = join(dir, "emitted");
    copyTree(join(TESTRUNS, "mobile-companion", "emitted"), copy);
    const file = join(copy, "src", "generated", "suggest-reorder-quantity.ts");
    const lines = read(file).split("\n");
    const counterAt = lines.findIndex((line) => /^const globalThisCounter: any =/.test(line));
    const storeAt = lines.findIndex((line) => /^const globalThisStore: any = null;/.test(line));
    assert.ok(counterAt >= 0 && storeAt === counterAt + 1, "the fixture's two adjacent const lines are present");
    [lines[counterAt], lines[storeAt]] = [lines[storeAt], lines[counterAt]];
    writeFileSync(file, lines.join("\n"));
    const repaired = runGuard("tree-invariants.mjs", ["--trees", copy, "--only", "use-before-declaration"]);
    assert.equal(repaired.status, 0, `hoisted copy must PASS: ${repaired.stdout}${repaired.stderr}`);
  });
});

test("C-09 readme-parity: fires on the 7 non-parity trees and passes on the parity controls", () => {
  const selftest = runGuard("readme-parity.mjs", ["--selftest", "--json"]);
  assert.equal(selftest.status, 0, `readme-parity selftest failed: ${selftest.stdout}${selftest.stderr}`);
  const verdict = JSON.parse(selftest.stdout);
  assert.equal(verdict.selftest.ok, true);
  const fired = runGuard("readme-parity.mjs", ["--trees", join(TESTRUNS, "office-scheduler", "emitted")]);
  assert.equal(fired.status, 1, "must fire on the absent src/jobs rows");
  const clean = runGuard("readme-parity.mjs", ["--trees", join(TESTRUNS, "bakery-florist-orders", "emitted")]);
  assert.equal(clean.status, 0, `parity control must pass: ${clean.stdout}`);
});

test("C-11 runlock-preflight: refuses the BL-010 timestamp set and allows the clean window", () => {
  const historical = preflight({
    runStart: "2026-10-05T21:32:58.000Z",
    srcMtimes: normalizeMtimes({
      "src/lib/harvest.ts": "2026-10-05T21:32:50.000Z",
      "src/lib/websearch.server.ts": "2026-10-05T21:34:01.000Z",
    }),
  });
  assert.equal(historical.ok, false, "the BL-010 overlap must be refused");
  assert.ok(historical.violations.some((v) => v.code === "RT_E_SRC_EDITED_DURING_RUN"));
  const clean = preflight({
    runStart: "2026-10-05T22:00:00.000Z",
    srcMtimes: normalizeMtimes({ "src/lib/harvest.ts": "2026-10-05T21:00:00.000Z" }),
  });
  assert.equal(clean.ok, true, "a clean window must be allowed");
  const guard = runGuard("runlock-preflight.mjs", ["--selftest", "--json"]);
  assert.equal(guard.status, 0, `runlock selftest failed: ${guard.stdout}${guard.stderr}`);
  assert.equal(JSON.parse(guard.stdout).selftest.ok, true);
});

// --- seam pins (import the REAL fixer exports; red pins name the lane) --------

test("C-05 specSourceHasBehaviouralAssert must be false for the real stub oracle", () => {
  const spec = read(join(TESTRUNS, "office-invoice-tracker", "emitted", "tests", "oracle.spec.ts"));
  const control = 'import { add } from "./m.ts";\ntest("x", () => { assert.equal(add(1, 1), 2); });';
  assert.equal(specSourceHasBehaviouralAssert(control), true, "a real assertion over a module read is behavioural");
  assert.equal(
    specSourceHasBehaviouralAssert(spec),
    false,
    "the real oracle's only live assertion is `assert.ok(names.length > 0)` and its skipped rows use assert.fail; the spec must not mint `tested` (INC-27). If this fails, B6 regressed.",
  );
});

test("C-12 out-of-scope text must not drive the classifier", () => {
  const corrected = ["bakery-website", "flower-shop-website", "bakery-florist-orders", "mobile-companion", "office-scheduler", "office-stock-tracker", "office-invoice-tracker"];
  for (const slug of corrected) {
    const brief = read(join(TESTRUNS, slug, "brief.md"));
    assert.notEqual(inferDomain(brief), "real-estate", `${slug} must not classify real-estate`);
    const kind = deliveryKindOf(/** @type {any} */ ({ brief, domain: "", kind: undefined, lattice: { jobs: [] } }));
    assert.ok(kind !== "game" && kind !== "library", `${slug} must not be ${kind}`);
  }
  // A genuine property brief must still classify real-estate (no over-stripping).
  assert.equal(inferDomain("Fix and flip houses, track ARV, run comps, renovate, list rental properties."), "real-estate");
  // The real out-of-scope clause from bakery-florist-orders/brief.md.
  assert.notEqual(
    inferDomain("- Multi-branch / multi-tenant support."),
    "real-estate",
    "C2 regressed: text in an 'Explicitly out of scope' clause wins the classification — the real clause '- Multi-branch / multi-tenant support.' must not yield real-estate. Strip negation/out-of-scope clauses before inferDomain.",
  );
});

test("C-16 inferName must not leak markdown", () => {
  for (const slug of ["bakery-website", "flower-shop-website", "office-scheduler"]) {
    const name = inferName(read(join(TESTRUNS, slug, "brief.md")));
    assert.equal(
      name.startsWith("#"),
      false,
      `inferName('${slug}') returned '${name}' with a leading markdown heading marker (C3 regressed)`,
    );
    assert.equal(name.endsWith("—"), false, `inferName('${slug}') returned '${name}' with a trailing em-dash`);
  }
});

test("C-14 p6-arch must fail closed on a keyed attempt with no tree", () => {
  const base = /** @type {any} */ (headless.loadProject(join(TESTRUNS, "office-stock-tracker", "build.json")));
  const item = DOD[6].find((candidate) => candidate.id === "p6-arch");
  assert.ok(item && typeof item.probe === "function", "the real p6-arch probe must exist");
  // The fixture's own logs carry a keyed attempt, so `{...base, generatedTree: []}`
  // is NOT the keyless floor the probe's legacy-pass branch is for.
  assert.ok(
    synthesisRowsOf(base) > 0,
    `office-stock-tracker/build.json carries ${synthesisRowsOf(base)} keyed-synthesis rows - a generatedTree-only control is not keyless (the pin was unsatisfiable)`,
  );
  const keylessNoTree = buildKeylessFloor(base);
  assert.equal(item.probe(keylessNoTree), true, "the keyless floor (no keyed attempt, absent tree) still passes");
  const sentinel = { ...keylessNoTree, logs: [...(keylessNoTree.logs ?? []), { event: "p6.synthesis.attempt", detail: "keyed P6 synthesis attempted" }] };
  assert.equal(
    item.probe(sentinel),
    false,
    "C8 regressed: the p6-arch probe returned true for a keyed synthesis attempt that landed NO tree — it must consult archTrace.present / a keyed-attempt flag and fail closed.",
  );
  assert.equal(archProductComplete(archTrace(base)), false, "a 2-file bridge tree is not product-complete");
});

test("C-18 the compiled packet must protect DoD + Research", () => {
  const project = headless.loadProject(join(TESTRUNS, "office-invoice-tracker", "build.json"));
  const packet = headless.packet(project);
  assert.equal(
    packet.includes("## Exit criteria (DoD)"),
    true,
    "C4 regressed: truncateToBudget drops the '## Exit criteria (DoD)' section on the real office-invoice-tracker packet — protect it (and '## Research sources (live)') like '## Required output schema'.",
  );
  assert.equal(packet.includes("## Research sources (live)"), true, "C4 regressed: the packet drops '## Research sources (live)'.");
});

// --- C-15 / C-17 (PR-23): the landed BL-011/BL-012/T3 fixes pinned -------------

test("C-15 deepen/approve honesty: the approve fixture is the historical over-approval and an empty-corpus deepen refuses", async () => {
  // Fixture-integrity: the recorded approve advanced a P6 gate carrying 3 unmet criteria (INC-14 / BL-012).
  const approve = JSON.parse(read(join(TESTRUNS, "office-invoice-tracker", "approve1.json")).replace(/^\uFEFF/, ""));
  const gate = approve.summary.lastGate;
  const unmet = approve.summary.failedGates[0].unmet.length;
  assert.equal(gate.decision, "approve", "the historical record approved the gate");
  assert.equal(unmet, 3, "the approved gate carried 3 unmet hard criteria");
  // Live seam: an empty-corpus deepen must refuse with the coded reason...
  const project = headless.loadProject(join(TESTRUNS, "office-invoice-tracker", "build.json"));
  await assert.rejects(
    () => deepenResearch({ ...project, research: [] }, 7, async () => ({ items: [], narrative: null, provider: null, unavailable: true })),
    { code: "RT_E_RESEARCH_UNAVAILABLE" },
    "PENDING lane C (C6 / C-15): an empty-corpus deepen must throw RT_E_RESEARCH_UNAVAILABLE and not re-record the gate",
  );
  // ...mutation control: a deepen that lands findings must NOT refuse (the rule is not unconditional).
  const landed = await deepenResearch({ ...project, research: [] }, 7, async () => ({
    items: [{ title: "t", url: "https://example.test/x", content: "c" }],
    narrative: null,
    provider: "test",
    unavailable: false,
  }));
  assert.ok(landed, "a findings-deepen must land (mutation control for the empty-corpus refusal)");
});

test("C-17 HTML numeric entities: the decode fix is present and the leak detector discriminates", () => {
  const harvest = read(join(ROOT, "src", "lib", "harvest.ts"));
  const websearch = read(join(ROOT, "src", "lib", "websearch.server.ts"));
  const decodeRe = /&#\(x\?\[0-9a-fA-F\]/;
  assert.ok(decodeRe.test(harvest), "harvest.ts stripMarkup decodes numeric entities (T3)");
  assert.ok(decodeRe.test(websearch), "websearch.server.ts stripHtml decodes numeric entities (T3)");
  const leak = (read(join(TESTRUNS, "bakery-website", "build.json")).match(/&#(x?[0-9a-fA-F]+);/g) || []).length;
  assert.ok(leak > 0, "the historical artifact leaked numeric entities (INC-22)");
  // Mutation control: the leak detector flags an escaped apostrophe and not a decoded one.
  assert.ok((`tenant&#x27;s`.match(/&#(x?[0-9a-fA-F]+);/g) || []).length > 0, "an escaped apostrophe is flagged");
  assert.equal((`tenant's`.match(/&#(x?[0-9a-fA-F]+);/g) || []).length, 0, "a decoded apostrophe is clean (control)");
});

// --- registry integrity (the meta-control) -----------------------------------

test("guard-registry.json: every guard/allowlist entry is complete and every enforced static proof holds", () => {
  const registryPath = join(GUARDS, "guard-registry.json");
  const registry = JSON.parse(read(registryPath));
  assert.ok(Array.isArray(registry.guards) && registry.guards.length >= 10, "the registry names every guard");
  for (const guard of registry.guards) {
    assert.ok(typeof guard.id === "string" && guard.id.length > 0, "every entry has an id");
    assert.ok(typeof guard.file === "string" && existsSync(join(ROOT, guard.file)), `${guard.id}: file exists`);
    assert.ok(typeof guard.expected === "string" && guard.expected.length > 0, `${guard.id}: expected output`);
    assert.ok(typeof guard.incident === "string" && guard.incident.length > 0, `${guard.id}: incident id`);
    assert.ok(typeof guard.keyless === "boolean", `${guard.id}: keyless flag`);
    assert.ok(guard.status === "enforced" || guard.status === "pending", `${guard.id}: status`);
    if (guard.status === "pending") {
      assert.ok(typeof guard.ownerLane === "string" && guard.ownerLane.length > 0, `${guard.id}: pending entries name the owning lane`);
      assert.ok(typeof guard.pendingInterface === "string" && guard.pendingInterface.length > 20, `${guard.id}: pending entries name the interface`);
    }
    if (guard.kind === "static") {
      assert.ok(typeof guard.historicalFixture === "string" && guard.historicalFixture.length > 0, `${guard.id}: historical fixture`);
      assert.ok(typeof guard.cleanControl === "string" && guard.cleanControl.length > 0, `${guard.id}: clean control`);
    }
  }
  for (const entry of registry.allowlist ?? []) {
    assert.ok(typeof entry.reason === "string" && entry.reason.length > 20, `allowlist entry ${entry.entry} needs a written reason`);
  }
  // No stale exemption: every readme-parity code allowlist key must have a
  // registry reason, and vice versa (a key that no longer exists is stale).
  const registryKeys = new Set((registry.allowlist ?? []).filter((a) => a.guard === "C-09").map((a) => String(a.entry).split("#")[1]));
  for (const key of Object.keys(PARITY_ALLOWLIST)) assert.ok(registryKeys.has(key), `readme-parity allowlist key '${key}' has no registry reason`);
  for (const key of registryKeys) assert.ok(Object.prototype.hasOwnProperty.call(PARITY_ALLOWLIST, key), `registry allowlist key '${key}' no longer exists in PARITY_ALLOWLIST (stale)`);
  // Enforced static guards must still fire on their historical fixture — a
  // now-passing fixture is a STALE entry and the registry mode exits non-zero.
  const treeRegistry = runGuard("tree-invariants.mjs", ["--registry", registryPath, "--json"]);
  assert.equal(treeRegistry.status, 0, `tree-invariants registry proof failed: ${treeRegistry.stdout}${treeRegistry.stderr}`);
  const readmeRegistry = runGuard("readme-parity.mjs", ["--registry", registryPath, "--json"]);
  assert.equal(readmeRegistry.status, 0, `readme-parity registry proof failed: ${readmeRegistry.stdout}${readmeRegistry.stderr}`);
});
