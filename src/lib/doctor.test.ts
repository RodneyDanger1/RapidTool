/**
 * fixes/210 G1 — factory-honest doctor latch.
 * Run: node --experimental-strip-types --test src/lib/doctor.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  classifyJobSource,
  coerceFactoryClaim,
  doctorFactory,
  doctorIsolation,
  doctorLlmKey,
  doctorSpend,
  evidenceFromJobInventory,
  factoryClaim,
  FACTORY_GAP,
  inventoryFromJobSources,
  jobScopeShortfall,
  productCompleteFromProject,
  RAPIDTOOL_FACTORY_EVIDENCE,
  readLastKeyedOutcome,
  treeEmissionCensus,
} from "./doctor.ts";
import { RUNNER_IS_NOT_A_SANDBOX } from "./sandbox-policy.ts";
import { archTrace } from "./dod.ts";
import type { Project } from "./types.ts";

describe("doctor factory — field-truth latch", () => {
  it("RapidTool-now evidence keeps autonomousSoftwareFactory false", () => {
    const c = doctorFactory({});
    assert.equal(c.autonomousSoftwareFactory, false);
    assert.equal(c.leftoverJobsAreReexportsOrStubs, true);
    assert.equal(c.chatHasSlashToolsOnly, true);
    assert.equal(c.runnerIsSandbox, false);
    assert.equal(c.isolation.sandbox, false);
    assert.equal(c.isolation.docker, false);
    assert.equal(c.isolation.bwrap, false);
    assert.equal(c.isolation.kind, "none");
    assert.equal(c.tokenCap, null);
    assert.ok(c.gaps.includes(FACTORY_GAP.leftover));
    assert.ok(c.gaps.includes(FACTORY_GAP.fixtures));
    assert.ok(c.gaps.includes(FACTORY_GAP.product));
    assert.ok(c.gaps.includes(FACTORY_GAP.complete));
    assert.equal("error" in c, false, "185-H1: factory claim never carries error");
    assert.equal("ok" in c, false, "185-H1: factory claim is not an ok envelope");
  });

  it("default factoryClaim (no args) matches RapidTool-now", () => {
    const a = factoryClaim();
    const b = factoryClaim(RAPIDTOOL_FACTORY_EVIDENCE);
    assert.equal(a.autonomousSoftwareFactory, false);
    assert.equal(b.autonomousSoftwareFactory, false);
    assert.deepEqual(a.gaps, b.gaps);
  });

  it("llm-configured is not field truth — factory stays false", () => {
    const c = factoryClaim({
      leftoverJobsAreReexportsOrStubs: true,
      humanFixtures: false,
      realMultiJobProduct: false,
      productComplete: false,
    });
    assert.equal(c.autonomousSoftwareFactory, false);
  });

  it("hostile autonomousSoftwareFactory:true without field truth coerces false", () => {
    const c = coerceFactoryClaim({
      autonomousSoftwareFactory: true,
      leftoverJobsAreReexportsOrStubs: true,
      runnerIsSandbox: true,
      isolation: { sandbox: true, docker: true, kind: "docker" },
    });
    assert.equal(c.autonomousSoftwareFactory, false);
    assert.equal(c.runnerIsSandbox, false);
    assert.equal(c.isolation.sandbox, false);
    assert.equal(c.isolation.docker, false);
    assert.equal(c.isolation.note, RUNNER_IS_NOT_A_SANDBOX);
    assert.ok(c.gaps.length > 0);
  });

  it("null/array/missing blobs coerce to RapidTool-now false", () => {
    assert.equal(coerceFactoryClaim(null).autonomousSoftwareFactory, false);
    assert.equal(coerceFactoryClaim([]).autonomousSoftwareFactory, false);
    assert.equal(coerceFactoryClaim(undefined).autonomousSoftwareFactory, false);
    assert.equal(coerceFactoryClaim("factory").autonomousSoftwareFactory, false);
  });

  it("true only when leftover stubs are gone + human fixtures + real multi-job + product-complete", () => {
    const c = factoryClaim({
      leftoverJobsAreReexportsOrStubs: false,
      humanFixtures: true,
      realMultiJobProduct: true,
      productComplete: true,
    });
    assert.equal(c.autonomousSoftwareFactory, true);
    assert.deepEqual(c.gaps, []);
    assert.equal(c.leftoverJobsAreReexportsOrStubs, false);
    assert.equal(c.runnerIsSandbox, false);
  });

  it("each missing field keeps factory false", () => {
    const base = {
      leftoverJobsAreReexportsOrStubs: false as const,
      humanFixtures: true,
      realMultiJobProduct: true,
      productComplete: true,
    };
    assert.equal(factoryClaim({ ...base, leftoverJobsAreReexportsOrStubs: true }).autonomousSoftwareFactory, false);
    assert.equal(factoryClaim({ ...base, humanFixtures: false }).autonomousSoftwareFactory, false);
    assert.equal(factoryClaim({ ...base, realMultiJobProduct: false }).autonomousSoftwareFactory, false);
    assert.equal(factoryClaim({ ...base, productComplete: false }).autonomousSoftwareFactory, false);
  });

  it("sandbox:true isolation cannot mint a factory claim", () => {
    const c = factoryClaim({
      leftoverJobsAreReexportsOrStubs: false,
      humanFixtures: true,
      realMultiJobProduct: true,
      productComplete: true,
      isolation: { sandbox: true, docker: true, bwrap: true, kind: "docker" },
    });
    assert.equal(c.isolation.sandbox, false);
    assert.equal(c.runnerIsSandbox, false);
    assert.equal(c.autonomousSoftwareFactory, true, "coerced isolation is honest false, so the latch can still fire on field truth");
  });

  it("tokenCap reads RAPIDTOOL_TOKEN_CAP from the passed env (unset → null)", () => {
    assert.equal(factoryClaim(RAPIDTOOL_FACTORY_EVIDENCE, {}).tokenCap, null);
    assert.equal(factoryClaim(RAPIDTOOL_FACTORY_EVIDENCE, { RAPIDTOOL_TOKEN_CAP: "0" }).tokenCap, null);
    assert.equal(factoryClaim(RAPIDTOOL_FACTORY_EVIDENCE, { RAPIDTOOL_TOKEN_CAP: "4096" }).tokenCap, 4096);
  });

  it("doctorIsolation is the frozen non-sandbox advertisement", () => {
    const iso = doctorIsolation();
    assert.equal(iso.sandbox, false);
    assert.equal(iso.docker, false);
    assert.equal(iso.bwrap, false);
    assert.equal(iso, doctorIsolation());
  });

  it("214 classifyJobSource: TODO stubs / reexports / real", () => {
    assert.equal(classifyJobSource(""), "stub");
    assert.equal(
      classifyJobSource(`export function runJob_2(input: unknown): { ok: boolean } {
  void input;
  throw new Error("TODO(E-15) stub: implement job flip");
}`),
      "stub",
    );
    assert.equal(classifyJobSource(`export { runJob } from "./track.ts";\n`), "reexport");
    assert.equal(
      classifyJobSource(`export function add(a: number, b: number) { return a + b; }\n`),
      "real",
    );

    const inv = inventoryFromJobSources(
      [
        { path: "src/jobs/flip.ts", source: 'throw new Error("TODO(E-15) stub: implement job flip");' },
        { path: "src/jobs/record.ts", source: 'throw new Error("TODO(E-15) stub");' },
        { path: "src/jobs/publish.ts", source: 'export { run } from "./track.ts";' },
        { path: "src/jobs/track.ts", source: "export function track() { return 1; }" },
      ],
      "/eval",
    );
    assert.equal(inv.stubs, 2);
    assert.equal(inv.reexports, 1);
    assert.equal(inv.real, 1);
    const ev = evidenceFromJobInventory(inv);
    assert.equal(ev.leftoverJobsAreReexportsOrStubs, true);
    assert.equal(ev.realMultiJobProduct, false);
    assert.equal(ev.humanFixtures, false);
    const claim = factoryClaim(ev, {});
    assert.equal(claim.autonomousSoftwareFactory, false);
    assert.equal(claim.inventory?.real, 1);
    assert.equal("error" in claim, false);
  });

  it("214 two real jobs and zero leftovers still need fixtures for factory=true", () => {
    const inv = inventoryFromJobSources([
      { path: "src/jobs/a.ts", source: "export function a() { return 1; }" },
      { path: "src/jobs/b.ts", source: "export function b() { return 2; }" },
    ]);
    const ev = evidenceFromJobInventory(inv);
    assert.equal(ev.leftoverJobsAreReexportsOrStubs, false);
    assert.equal(ev.realMultiJobProduct, true);
    assert.equal(factoryClaim(ev, {}).autonomousSoftwareFactory, false, "fixtures still missing");
    assert.equal(
      factoryClaim({ ...ev, humanFixtures: true, productComplete: true }, {}).autonomousSoftwareFactory,
      true,
    );
  });

  // --- fixes/216k (106 T-13 / F-10) — counted declared-vs-materialised census ---

  it("216k T-13: the corpus shape counts 10 declared vs 5 materialised with the 5 missing jobs named", () => {
    const declared = ["track", "record", "flip", "show", "publish", "sync", "lease", "stage", "rent", "bid"];
    const nodeLabels = ["track", "record", "flip", "show", "publish"];
    const s = jobScopeShortfall(declared, nodeLabels);
    assert.equal(s.declared, 10);
    assert.equal(s.materialised, 5);
    assert.deepEqual(s.missing, ["sync", "lease", "stage", "rent", "bid"]);
    assert.equal(s.declared, s.materialised + s.missing.length, "counted shortfall must reconcile");
  });

  it("216k T-13: a 5-job brief is truthful — declared === materialised, nothing missing", () => {
    const declared = ["track", "record", "lease", "rent"];
    const s = jobScopeShortfall(declared, declared);
    assert.equal(s.declared, 4);
    assert.equal(s.materialised, 4);
    assert.deepEqual(s.missing, []);
    // Defensive input handling: junk entries never fabricate a count.
    const dirty = jobScopeShortfall([null, " record ", "", 7 as unknown as string], [undefined, "record"]);
    assert.equal(dirty.declared, 1);
    assert.equal(dirty.materialised, 1);
    assert.deepEqual(dirty.missing, []);
    const empty = jobScopeShortfall(undefined, null);
    assert.deepEqual(
      { declared: empty.declared, materialised: empty.materialised, missing: empty.missing },
      { declared: 0, materialised: 0, missing: [] },
    );
  });

  it("216k TA-15: the corpus-shaped emitted tree censuses reexports:0 stubs:0 real:3 (bridge teeth)", () => {
    // The three REAL per-job modules the 216k tree mapping writes at the spec-graph
    // job-node paths — ESM with the job's own functions (not a re-export).
    const realJobs = [
      {
        path: "src/jobs/record.ts",
        source: [
          "function recordShowingFeedback(bookingId) { return { bookingId }; }",
          "export { recordShowingFeedback };",
        ].join("\n"),
      },
      {
        path: "src/jobs/flip.ts",
        source: ["function createFlipProject(propertyId) { return { propertyId }; }", "export { createFlipProject };"].join("\n"),
      },
      {
        path: "src/jobs/show.ts",
        source: ["function bookShowing(slotId) { return { slotId }; }", "export { bookShowing };"].join("\n"),
      },
    ];
    const fixed = inventoryFromJobSources(realJobs, "/eval");
    assert.equal(fixed.reexports, 0);
    assert.equal(fixed.stubs, 0);
    assert.equal(fixed.real, 3);
    assert.equal(evidenceFromJobInventory(fixed).realMultiJobProduct, true);

    // TEETH: the pre-216k shape — the same three paths as entry re-exports — must
    // census as leftovers. If the classifier accepted these, the done-when triple
    // would be meaningless.
    const bridges = realJobs.map((f) => ({ path: f.path, source: 'export * from "../generated.ts";\n' }));
    const pre = inventoryFromJobSources(bridges, "/eval");
    assert.equal(pre.reexports, 3);
    assert.equal(pre.real, 0);
    assert.equal(evidenceFromJobInventory(pre).realMultiJobProduct, false);
  });
});

// ---------------------------------------------------------------------------
// W45 · 331-4 (Composer) — the declared-vs-emitted job census
// ---------------------------------------------------------------------------

describe("W45 · 331-4 — declared-vs-emitted job census", () => {
  /** The exact keyless P6 floor shape (sandbox.buildPhase6Module), embedded
   *  verbatim by scaffold.emitGeneratedHost under the first job path. Its bytes
   *  carry real statements, but they implement phase bookkeeping, not the job. */
  const KEYLESS_TEMPLATE = [
    'const JOBS = ["flip"];',
    'const REJECTION = "";',
    "function synthesize(spec) {",
    '  if (spec.phase < 0 || spec.phase > 12) throw new Error("invalid phase");',
    "  return { ok: true, name: spec.name, job: spec.job };",
    "}",
    "function test_no_skip() {}",
  ].join("\n");

  it("classifyJobSource: the deterministic keyless template is a leftover stub, not a real job", () => {
    assert.equal(classifyJobSource(KEYLESS_TEMPLATE), "stub");
    const inv = inventoryFromJobSources([{ path: "src/jobs/flip.ts", source: KEYLESS_TEMPLATE }], "/keyless");
    assert.equal(inv.stubs, 1);
    assert.equal(inv.real, 0);
    assert.equal(inv.reexports, 0);
    const ev = evidenceFromJobInventory(inv);
    assert.equal(ev.leftoverJobsAreReexportsOrStubs, true, "a placeholder job is a leftover");
    assert.equal(ev.realMultiJobProduct, false);
    assert.equal(ev.productComplete, false);
    // TEETH: the same shape without the template functions is a real job module.
    assert.equal(classifyJobSource("export function runFlip() { return { ok: true }; }"), "real");
  });

  it("treeEmissionCensus names a declared job the tree never materialised (the café `track` shortfall)", () => {
    const declared = ["track", "record", "flip", "show", "lease"];
    const inv = inventoryFromJobSources([
      { path: "src/jobs/flip.ts", source: "export function createFlipProject() { return 1; }" },
      { path: "src/jobs/record.ts", source: "export function recordAcquisition() { return 1; }" },
      { path: "src/jobs/show.ts", source: "export function bookShowing() { return 1; }" },
      { path: "src/jobs/lease.ts", source: "export function createLease() { return 1; }" },
    ]);
    assert.deepEqual([inv.stubs, inv.reexports, inv.real], [0, 0, 4]);
    const c = treeEmissionCensus(declared, inv);
    assert.equal(c.declared, 5);
    assert.deepEqual(c.materialised, ["record", "flip", "show", "lease"]);
    assert.deepEqual(c.missing, ["track"]);
    assert.equal(c.loud, true);
    // Full coverage silences it — the census is a count, not a constant alarm.
    const full = treeEmissionCensus(declared.slice(1), inv);
    assert.equal(full.missing.length, 0);
    assert.equal(full.loud, false);
    // A stub at the job path never counts as materialised.
    const stubInv = inventoryFromJobSources([
      { path: "src/jobs/track.ts", source: 'throw new Error("RT_E_VALIDATION · TODO(E-15) stub: implement job track");' },
    ]);
    const sc = treeEmissionCensus(["track"], stubInv);
    assert.deepEqual(sc.materialised, []);
    assert.deepEqual(sc.missing, ["track"]);
    // Sibling overflow (`flip-2.ts`) still materialises `flip`.
    const sib = inventoryFromJobSources([{ path: "src/jobs/flip-2.ts", source: "export function addRenovationLineItem() { return 1; }" }]);
    assert.deepEqual(treeEmissionCensus(["flip"], sib).materialised, ["flip"]);
  });

  it("treeEmissionCensus over the REAL tracked café run bytes: 10 declared, 0 materialised (5 reexport bridges)", () => {
    const dir = join(REPO_ROOT, "research", "eval-out", "coffeehouse2home-property-ledger.run-2026-09-10");
    const real = readRealExport("coffeehouse2home-property-ledger.run-2026-09-10");
    const declared = (real.lattice as { jobs?: string[] }).jobs ?? [];
    assert.equal(declared.length, 10, "the tracked export still declares 10 lattice jobs");
    const inv = inventoryFromJobSources(readTreeJobSources(dir), dir);
    assert.equal(inv.reexports, 5, "the 5 tree-bridge job files are reexport-only");
    const c = treeEmissionCensus(declared, inv);
    assert.equal(c.declared, 10);
    assert.equal(c.materialised.length, 0, "no real job module on these bytes");
    assert.equal(c.missing.length, 10);
    assert.equal(c.loud, true);
  });
});

// ---------------------------------------------------------------------------
// OV-9 (W18-L1): `productComplete`'s producer — real project state, never a flag
//
// Pre-OV-9 the latch's productComplete input was settable only by a unit test:
// the sole caller (headless.doctorStatus, the `doctor --tree` path) passed no
// evidence, and coerceFactoryClaim read the flag straight off a raw blob.
// productCompleteFromProject derives the field from the project's own artifact
// state instead — the generatedTree bytes, through the SAME p6-arch trace the
// P6 gate reads. Grounding: (a) the ONE tracked real export that ships a
// generatedTree (`research/eval-out/coffeehouse2home-property-ledger`, tracked
// and clean) refuses on its NAMED leftover, and the verdict flips when exactly
// that file is dropped — real bytes, both directions; (b) the keyed multi-file
// arch-complete shape fires the producer and the latch then lacks only the
// (not yet produced) fixture probe. A hand-passed flag can never mint the field.
// ---------------------------------------------------------------------------

const REPO_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const realExportPath = (app: string): string =>
  join(REPO_ROOT, "research", "eval-out", app, ".rapidtool", "project.json");
/** A tracked real export the tests rely on. A missing file is a FAIL — the
 *  refusal ground is real bytes on disk, never a silent skip. */
const readRealExport = (app: string): Record<string, unknown> => {
  const path = realExportPath(app);
  assert.ok(existsSync(path), `tracked real export missing: ${path}`);
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
};
/** headless.collectJobSources mirror (8 lines): the tree's OWN job files. Kept
 *  local so this suite does not compile the whole headless module. */
const readTreeJobSources = (dir: string): Array<{ path: string; source: string }> => {
  const out: Array<{ path: string; source: string }> = [];
  for (const sub of ["src/jobs", "jobs"]) {
    const full = join(dir, sub);
    if (!existsSync(full)) continue;
    for (const name of readdirSync(full)) {
      if (!/\.(ts|js|mjs)$/.test(name)) continue;
      out.push({ path: `${sub}/${name}`, source: readFileSync(join(full, name), "utf8") });
    }
  }
  return out;
};

/** Keyed multi-file shape: an expanded spec demanding createBoard/addColumn +
 *  tree files whose CODE carries those identifiers. */
const OV9_SPEC = {
  requirements: ["Board shows cards by status", "Columns hold cards"],
  edgeCases: [],
  errorHandling: [],
  typeSignatures: [
    "export function createBoard(name: string): Board",
    "export function addColumn(board: Board, title: string): Column",
  ],
  dataFlow: [],
  negativeConstraints: [],
  source: "p6" as const,
  briefHash: "ov9-fixture",
  createdAt: 1,
} as Project["implementationSpec"];

const OV9_TREE = (): NonNullable<Project["generatedTree"]> =>
  [
    {
      path: "src/domain/board.ts",
      source: [
        "export type Board = { id: string; name: string; columns: Column[] };",
        "export function createBoard(name: string): Board { return { id: 'b1', name, columns: [] }; }",
      ].join("\n"),
      hash: "h-ov9-board",
      attempt: 0,
    },
    {
      path: "src/domain/column.ts",
      source: [
        "export type Column = { id: string; title: string };",
        "export function addColumn(board: Board, title: string): Column { return { id: 'c1', title }; }",
      ].join("\n"),
      hash: "h-ov9-column",
      attempt: 0,
    },
  ] as NonNullable<Project["generatedTree"]>;

const ov9Project = (tree: NonNullable<Project["generatedTree"]> = OV9_TREE()): Project =>
  ({
    name: "OV-9 Board",
    lattice: {
      domain: "boards",
      jobs: ["board", "column"],
      entities: [],
      constraints: [],
      nodes: [],
      complexity: 2,
    },
    phases: [],
    generatedTree: tree,
    implementationSpec: OV9_SPEC,
  }) as unknown as Project;

describe("OV-9 — productComplete derives from real project state", () => {
  it("producer FIRES on the arch-complete keyed multi-file shape; the only remaining latch gap is the unproduced fixture probe", () => {
    const p = ov9Project();
    assert.equal(productCompleteFromProject(p), true, "arch-complete tree must mint productComplete");
    // Same bar as the P6 gate — one derivation, no drift:
    assert.deepEqual(archTrace(p).missing, []);
    assert.deepEqual(archTrace(p).stubFiles, []);

    const inv = inventoryFromJobSources([
      { path: "src/jobs/board.ts", source: "export function createBoard() { return { id: 'b1' }; }" },
      { path: "src/jobs/column.ts", source: "export function addColumn() { return { id: 'c1' }; }" },
    ]);
    const ev = evidenceFromJobInventory(inv, { project: p });
    assert.equal(ev.productComplete, true, "the evidence builder carries the PRODUCED value");
    assert.equal(ev.leftoverJobsAreReexportsOrStubs, false);
    assert.equal(ev.realMultiJobProduct, true);

    const claim = factoryClaim(ev, {});
    assert.equal(claim.autonomousSoftwareFactory, false, "fixtures still have no producer (T5.2-A's lane)");
    assert.deepEqual(claim.gaps, [FACTORY_GAP.fixtures], "the ONLY gap left is the fixture probe");
    // Latch semantics (:81-92, unchanged): once the fixture probe has its value
    // the AND fires — the produced productComplete is latch-grade, not a token.
    const fired = factoryClaim({ ...ev, humanFixtures: true }, {});
    assert.equal(fired.autonomousSoftwareFactory, true);
    assert.deepEqual(fired.gaps, []);
  });

  it("the REAL café export refuses on real bytes — the in-tree assembly barrel is exempt (§P2), the counted census is not", () => {
    const real = readRealExport("coffeehouse2home-property-ledger");
    const tree = real.generatedTree as Array<{ path: string }>;
    assert.ok(Array.isArray(tree) && tree.length > 0, "the tracked export still carries a generatedTree");

    assert.equal(productCompleteFromProject(real), false, "the real product is not product-complete");
    // `readRealExport` yields the tracked blob as a loose record; `archTrace`
    // takes the typed shape. Same seam-cast the product itself uses
    // (doctor.ts `productCompleteFromProject`: validate, then `as Project`).
    const t = archTrace(real as Project);
    // Drift repair (fixes/263 L1): the live tracked blob is now the later
    // single-chunk keyed run's export (`src/generated/get-property.ts`, no
    // barrel), so the refusal ground on the CURRENT bytes is counted, not
    // named: un-implemented capabilities, with no stub file at all.
    assert.deepEqual(t.stubFiles, [], "no tree file is a stub on the current tracked bytes");
    assert.ok(t.missing.length > 0, "the refusal ground is un-implemented capabilities (counted)");

    // Differential on real bytes: the historic tracked run export — the bytes
    // the W23 §P2 exemption was derived from — carries the 5-file tree whose
    // assembly barrel `src/generated.ts` reexports ONLY in-tree files. That is
    // exempt, not a leftover: the arch bar is met, so the verdict tracks
    // content rather than a flag. (E-15-style out-of-tree leftovers stay stubs.)
    const historic = readRealExport("coffeehouse2home-property-ledger.run-2026-09-10");
    const htree = historic.generatedTree as Array<{ path: string }>;
    assert.ok(Array.isArray(htree) && htree.length === 5, "the historic run export carries its 5-file tree");
    assert.ok(htree.some((f) => f.path === "src/generated.ts"), "…including the assembly barrel");
    const ht = archTrace(historic as Project);
    assert.deepEqual(ht.stubFiles, [], "the in-tree reexport barrel is exempt (fixes/255 §P2)");
    assert.deepEqual(ht.missing, [], "…and every expanded-spec capability maps to a real tree file");
    assert.equal(productCompleteFromProject(historic), true, "the arch bar alone is met by these real bytes");

    // End-to-end evidence build over each real tree dir's own bytes (the 214
    // census) + the real export: the census is the gate that still refuses.
    const dir = join(REPO_ROOT, "research", "eval-out", "coffeehouse2home-property-ledger");
    const inv = inventoryFromJobSources(readTreeJobSources(dir), dir);
    assert.equal(inv.real, 0, "the live dir ships no src/jobs tree: honest zero counts");
    const ev = evidenceFromJobInventory(inv, { project: real });
    assert.equal(ev.productComplete, false, "a zero-real-job census refuses productComplete");
    assert.equal(ev.leftoverJobsAreReexportsOrStubs, true);
    assert.equal(factoryClaim(ev, {}).autonomousSoftwareFactory, false);

    const hdir = join(REPO_ROOT, "research", "eval-out", "coffeehouse2home-property-ledger.run-2026-09-10");
    const hinv = inventoryFromJobSources(readTreeJobSources(hdir), hdir);
    assert.equal(hinv.reexports, 5, "the 5 tree-bridge job files are reexport-only");
    const hev = evidenceFromJobInventory(hinv, { project: historic });
    assert.equal(hev.productComplete, false, "the counted leftover census refuses the claim even though the arch bar passed");
    assert.equal(hev.leftoverJobsAreReexportsOrStubs, true);
    assert.equal(factoryClaim(hev, {}).autonomousSoftwareFactory, false);
  });

  it("REFUSES when the real state lacks it — tree-absent export, dropped tree, stubs, non-object state", () => {
    // A real tracked export with NO tree (keyless single-module floor): a SKIP.
    const floored = readRealExport("real-estate-crm");
    // Same seam-cast as above — the loader's record vs the typed trace input.
    assert.equal(archTrace(floored as Project).skipped, true, "the real floor is a SKIP, not complete");
    assert.equal(productCompleteFromProject(floored), false, "skip ≠ green");

    // The keyed shape with the tree dropped / a capability dropped / a stub kept.
    assert.equal(productCompleteFromProject(ov9Project([])), false, "absent tree refuses");
    assert.equal(productCompleteFromProject(ov9Project(OV9_TREE().slice(0, 1))), false, "missing capability refuses");
    const withTodo = [
      ...OV9_TREE(),
      {
        path: "src/jobs/flip.ts",
        source: 'throw new Error("TODO(E-15) stub: implement job flip");',
        hash: "h-todo",
        attempt: 0,
      },
    ] as NonNullable<Project["generatedTree"]>;
    assert.equal(productCompleteFromProject(ov9Project(withTodo)), false, "TODO(E-15) stub ≠ complete");
    const withReexport = [
      ...OV9_TREE(),
      { path: "src/jobs/leftover.ts", source: 'export { run } from "./track.ts";', hash: "h-re", attempt: 0 },
    ] as NonNullable<Project["generatedTree"]>;
    assert.equal(productCompleteFromProject(ov9Project(withReexport)), false, "reexport-only leftover ≠ complete");

    // Hostile/absent state is never assumed: fail-closed, never a throw.
    for (const junk of [null, undefined, [], "", 42, true, {}, "{}"]) {
      assert.equal(productCompleteFromProject(junk), false, `non-project state must refuse: ${String(junk)}`);
    }
  });

  it("ANTI-GOAL: a hand-passed productComplete flag cannot mint the field (typed or untyped caller)", () => {
    const inv = inventoryFromJobSources([
      { path: "src/jobs/a.ts", source: "export function a() { return 1; }" },
      { path: "src/jobs/b.ts", source: "export function b() { return 2; }" },
    ]);
    // The old flag, exactly as an untyped .mjs caller would pass it (the CLI is
    // JS): the builder is keyed to `project` now and ignores the flag at runtime.
    const untyped = { productComplete: true } as never;
    const ev = evidenceFromJobInventory(inv, untyped);
    assert.equal(ev.productComplete, false, "the flag is not read");
    const claim = factoryClaim(ev, {});
    assert.equal(claim.autonomousSoftwareFactory, false);
    assert.ok(claim.gaps.includes(FACTORY_GAP.complete), "the complete gap stands");

    // Same through the coercion boundary: a raw blob claiming the whole field
    // truth cannot mint product-complete without real project state.
    const blob = {
      autonomousSoftwareFactory: true,
      leftoverJobsAreReexportsOrStubs: false,
      humanFixtures: true,
      realMultiJobProduct: true,
      productComplete: true,
    };
    const coerced = coerceFactoryClaim(blob);
    assert.equal(coerced.autonomousSoftwareFactory, false);
    assert.deepEqual(coerced.gaps, [FACTORY_GAP.complete], "only the unminted probe refuses");
    // Handed the REAL state the same blob derives the bar honestly: still false
    // for a floor export, and closed only by the arch-complete project.
    assert.ok(coerceFactoryClaim(blob, readRealExport("real-estate-crm")).gaps.includes(FACTORY_GAP.complete));
    assert.deepEqual(coerceFactoryClaim(blob, ov9Project()).gaps, []);
  });

  it("the 214 census cross-gate is unchanged: a complete project over a leftover census still refuses", () => {
    const inv = inventoryFromJobSources([
      { path: "src/jobs/board.ts", source: "export function createBoard() { return { id: 'b1' }; }" },
      { path: "src/jobs/leftover.ts", source: 'export { run } from "./track.ts";' },
    ]);
    const ev = evidenceFromJobInventory(inv, { project: ov9Project() });
    assert.equal(ev.productComplete, false, "no loosening: the scan's leftovers still refuse the bar");
    assert.equal(ev.leftoverJobsAreReexportsOrStubs, true);
    assert.equal(ev.realMultiJobProduct, false);
  });
});

describe("W46 · 332-2 (L1/AW45-c06) — doctor spend reads a persisted run slice", () => {
  it("a persisted run slice reports its real tokens + calls, cost stays null (no catalog)", () => {
    const spend = doctorSpend({ promptTokens: 60000, completionTokens: 17654, calls: 12 });
    assert.equal(spend.measured, true);
    assert.equal(spend.totalTokens, 77654);
    assert.equal(spend.calls, 12);
    assert.equal(spend.estimatedCostUsd, null, "no caller prices ⇒ no dollar figure, ever");
    assert.equal(spend.pricesSupplied, false);
    assert.ok(spend.line.includes("no caller prices"), "the honest no-catalog line rides");
    assert.ok(spend.line.includes("12 call(s)"), "the recorded call count is surfaced");
  });

  it("a legacy 2-key slice reads calls/cache as null — never a fabricated 0", () => {
    const spend = doctorSpend({ promptTokens: 10, completionTokens: 5 });
    assert.equal(spend.measured, true);
    assert.equal(spend.totalTokens, 15);
    assert.equal(spend.calls, null, "absence is honest null, not 0");
    assert.equal(spend.cachedPromptTokens, null);
  });

  it("an empty session ledger is a measured zero (not the same as no ledger)", () => {
    const zero = doctorSpend({ promptTokens: 0, completionTokens: 0, calls: 0 });
    assert.equal(zero.measured, true);
    assert.equal(zero.totalTokens, 0);
    assert.equal(zero.calls, 0);
  });
});

describe("W46 · 332-2 (F-5) — key presence is not key validity", () => {
  it("a key-unusable class flips to rejected and carries the tail-only outcome", () => {
    const keyed = doctorLlmKey(true, {
      code: "RT_E_LLM_KEY_REJECTED",
      at: 1759000000000,
      keySource: "the process environment (tail …a1b2)",
    });
    assert.equal(keyed.keyState, "rejected");
    assert.deepEqual(keyed.lastKeyed, {
      code: "RT_E_LLM_KEY_REJECTED",
      at: 1759000000000,
      keySource: "the process environment (tail …a1b2)",
    });
  });

  it("presence with no recorded outcome is unverified — never an implied green", () => {
    assert.deepEqual(doctorLlmKey(true), { keyState: "unverified" });
  });

  it("no key is not-configured (and drops a stale outcome — nothing to attribute)", () => {
    assert.deepEqual(doctorLlmKey(false, { code: "RT_E_LLM_KEY_REJECTED", at: 1 }), {
      keyState: "not-configured",
    });
    assert.deepEqual(doctorLlmKey(false), { keyState: "not-configured" });
  });

  it("a transient failure never condemns a working key (stays unverified, keeps the class)", () => {
    const keyed = doctorLlmKey(true, { code: "RT_E_LLM_TIMEOUT", at: 5 });
    assert.equal(keyed.keyState, "unverified");
    assert.equal(keyed.lastKeyed?.code, "RT_E_LLM_TIMEOUT");
  });

  it("a hostile/partial outcome is dropped, not trusted", () => {
    for (const junk of [null, undefined, "RT_E_LLM_KEY_REJECTED", 7, {}, { code: "", at: 1 }, { code: "x" }, { code: "x", at: Number.NaN }, { code: 7, at: 1 }]) {
      assert.equal(readLastKeyedOutcome(junk), undefined, `junk ${JSON.stringify(junk)} dropped`);
      assert.deepEqual(doctorLlmKey(true, junk), { keyState: "unverified" }, "junk never mints rejected");
    }
    assert.deepEqual(
      readLastKeyedOutcome({ code: "RT_E_LLM_KEY_SHADOWED", at: 5, keySource: "" }),
      { code: "RT_E_LLM_KEY_SHADOWED", at: 5 },
      "an empty keySource is dropped, the class is kept",
    );
  });
});
