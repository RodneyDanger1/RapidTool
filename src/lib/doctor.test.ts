/**
 * fixes/210 G1 — factory-honest doctor latch.
 * Run: node --experimental-strip-types --test src/lib/doctor.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyJobSource,
  coerceFactoryClaim,
  doctorFactory,
  doctorIsolation,
  evidenceFromJobInventory,
  factoryClaim,
  FACTORY_GAP,
  inventoryFromJobSources,
  jobScopeShortfall,
  RAPIDTOOL_FACTORY_EVIDENCE,
} from "./doctor.ts";
import { RUNNER_IS_NOT_A_SANDBOX } from "./sandbox-policy.ts";

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
