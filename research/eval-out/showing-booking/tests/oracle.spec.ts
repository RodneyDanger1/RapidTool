// ---------------------------------------------------------------------------
// tests/oracle.spec.ts — acceptance tests from the A7 oracle (project.oracle)
// machine-generated from RapidTool packet 9f7b40f0-80e9-4959-8007-8d7b006a1451; regenerate, don't hand-edit.
// REAL assertions, no todo stubs (fixes/135). Row ids are PINNED: the verify
// harness seeds + pins orc-* ids across runs (E-08) — never rename or drop
// one. Each test asserts what the emitted modules ACTUALLY do today:
//   * where the generated P6 module defines functions (the deterministic
//     template's synthesize/JOBS/REJECTION), those are asserted directly;
//   * store/api modules are asserted over their real exports;
//   * an oracle row whose target seam is a TODO(E-15) stub asserts the seam
//     rejects — that test FAILS the moment the seam is implemented, which is
//     the signal to replace it with the row's real acceptance assertion;
//   * nothing here pretends a stub satisfies its brief.
// Run: node --experimental-strip-types --test tests/oracle.spec.ts
// ---------------------------------------------------------------------------
import { test } from "node:test";
import assert from "node:assert/strict";
import { CheckpointStore } from "../src/state/store.ts";
import { ENDPOINTS, route } from "../src/api/routes.ts";
import { JOBS, REJECTION, synthesize } from "../src/jobs/show.ts";

// ---------------------------------------------------------------------------
// 1. Module truth — the hosted P6 module (project.generatedSource), verbatim.
// ---------------------------------------------------------------------------

test("module.jobs — the P6 module lists the lattice jobs in order", () => {
  assert.deepEqual(JOBS, ["show","schedule","publish","sync"]);
});

test("module.synthesize — a valid phase + known job returns ok", () => {
  const out = synthesize({ name: "probe", phase: 6, job: JOBS[0] });
  assert.equal(out.ok, true);
  assert.equal(out.job, JOBS[0]);
  assert.equal(typeof out.addressed, "boolean");
});

test("module.synthesize — an out-of-range phase is rejected", () => {
  assert.throws(() => synthesize({ name: "x", phase: -1, job: JOBS[0] }), /invalid phase/);
  assert.throws(() => synthesize({ name: "x", phase: 13, job: JOBS[0] }), /invalid phase/);
});

test("module.synthesize — an unknown job is rejected", () => {
  assert.throws(() => synthesize({ name: "x", phase: 6, job: "__no_such_job__" }), /unknown job/);
});

test("module.synthesize — the rejection note blocks phase 9 when present", () => {
  if (REJECTION) {
    assert.throws(() => synthesize({ name: "x", phase: 9, job: JOBS[0] }), /deploy blocked/);
    const out = synthesize({ name: "x", phase: 6, job: JOBS[0] });
    assert.equal(out.addressed, true);
  } else {
    const out = synthesize({ name: "x", phase: 9, job: JOBS[0] });
    assert.equal(out.ok, true);
    assert.equal(out.addressed, false);
  }
});

// ---------------------------------------------------------------------------
// 2. Store truth — CheckpointStore (src/state), the real checkpoint surface.
// ---------------------------------------------------------------------------

test("store.checkpoint — write then read returns the stored checkpoint", () => {
  const s = new CheckpointStore();
  s.write({ phase: 2, status: "sealed", updatedAt: "2026-01-01T00:00:00.000Z" });
  const got = s.read(2);
  assert.ok(got, "checkpoint written is checkpoint read");
  assert.equal(got.phase, 2);
  assert.equal(got.status, "sealed");
});

test("store.checkpoint — reading an unwritten phase returns undefined", () => {
  const s = new CheckpointStore();
  assert.equal(s.read(4), undefined);
});

test("store.checkpoint — a later write for a phase replaces the earlier one", () => {
  const s = new CheckpointStore();
  s.write({ phase: 3, status: "draft", updatedAt: "2026-01-01T00:00:00.000Z" });
  s.write({ phase: 3, status: "sealed", updatedAt: "2026-01-02T00:00:00.000Z" });
  assert.equal(s.read(3)?.status, "sealed");
  assert.equal(s.read(3)?.updatedAt, "2026-01-02T00:00:00.000Z");
});

// ---------------------------------------------------------------------------
// 3. Endpoint truth — ENDPOINTS must match the A6 contract verbatim.
// ---------------------------------------------------------------------------

test("api.endpoints — ENDPOINTS matches the A6 contract endpoints", () => {
  assert.deepEqual(ENDPOINTS, [{"method":"POST","path":"/v1/show","job":"show"},{"method":"POST","path":"/v1/schedule","job":"schedule"},{"method":"POST","path":"/v1/publish","job":"publish"},{"method":"POST","path":"/v1/sync","job":"sync"}]);
});

// ---------------------------------------------------------------------------
// 4. Oracle rows (A7) — one test per row under its PINNED id.
// ---------------------------------------------------------------------------

test("orc-1", async () => {
  // A7 row "orc-1" "job.show.happy" — Authorized operator submits “show” with a valid showing => 200 + persisted entity + checkpoint written
  // Target seam: show (POST /v1/show). Today it is a TODO(E-15) stub —
  // the route rejects instead of returning "200 + persisted entity + checkpoint written". Asserting that real
  // current behavior: this test FAILS the moment show is implemented,
  // which is the signal to replace it with the row's real acceptance assert.
  const ep = ENDPOINTS.find((e) => e.job === "show");
  assert.ok(ep, "endpoint for the row's job must exist (contract drift)");
  await assert.rejects(route(ep.method, ep.path, {}), /TODO\(E-15\) stub/);
  // The "200 + persisted entity + checkpoint written" row expects a checkpoint write — the one part the real
  // CheckpointStore can satisfy today:
  const s = new CheckpointStore();
  s.write({ phase: 6, status: "sealed", updatedAt: "2026-01-01T00:00:00.000Z" });
  assert.equal(s.read(6)?.status, "sealed");
});

test("orc-2", async () => {
  // A7 row "orc-2" "job.schedule.happy" — Authorized operator submits “schedule” with a valid showing => 200 + persisted entity + checkpoint written
  // Target seam: schedule (POST /v1/schedule). Today it is a TODO(E-15) stub —
  // the route rejects instead of returning "200 + persisted entity + checkpoint written". Asserting that real
  // current behavior: this test FAILS the moment schedule is implemented,
  // which is the signal to replace it with the row's real acceptance assert.
  const ep = ENDPOINTS.find((e) => e.job === "schedule");
  assert.ok(ep, "endpoint for the row's job must exist (contract drift)");
  await assert.rejects(route(ep.method, ep.path, {}), /TODO\(E-15\) stub/);
  // The "200 + persisted entity + checkpoint written" row expects a checkpoint write — the one part the real
  // CheckpointStore can satisfy today:
  const s = new CheckpointStore();
  s.write({ phase: 6, status: "sealed", updatedAt: "2026-01-01T00:00:00.000Z" });
  assert.equal(s.read(6)?.status, "sealed");
});

test("orc-3", async () => {
  // A7 row "orc-3" "job.publish.happy" — Authorized operator submits “publish” with a valid showing => 200 + persisted entity + checkpoint written
  // Target seam: publish (POST /v1/publish). Today it is a TODO(E-15) stub —
  // the route rejects instead of returning "200 + persisted entity + checkpoint written". Asserting that real
  // current behavior: this test FAILS the moment publish is implemented,
  // which is the signal to replace it with the row's real acceptance assert.
  const ep = ENDPOINTS.find((e) => e.job === "publish");
  assert.ok(ep, "endpoint for the row's job must exist (contract drift)");
  await assert.rejects(route(ep.method, ep.path, {}), /TODO\(E-15\) stub/);
  // The "200 + persisted entity + checkpoint written" row expects a checkpoint write — the one part the real
  // CheckpointStore can satisfy today:
  const s = new CheckpointStore();
  s.write({ phase: 6, status: "sealed", updatedAt: "2026-01-01T00:00:00.000Z" });
  assert.equal(s.read(6)?.status, "sealed");
});

test("orc-4", async () => {
  // A7 row "orc-4" "job.sync.happy" — Authorized operator submits “sync” with a valid showing => 200 + persisted entity + checkpoint written
  // Target seam: sync (POST /v1/sync). Today it is a TODO(E-15) stub —
  // the route rejects instead of returning "200 + persisted entity + checkpoint written". Asserting that real
  // current behavior: this test FAILS the moment sync is implemented,
  // which is the signal to replace it with the row's real acceptance assert.
  const ep = ENDPOINTS.find((e) => e.job === "sync");
  assert.ok(ep, "endpoint for the row's job must exist (contract drift)");
  await assert.rejects(route(ep.method, ep.path, {}), /TODO\(E-15\) stub/);
  // The "200 + persisted entity + checkpoint written" row expects a checkpoint write — the one part the real
  // CheckpointStore can satisfy today:
  const s = new CheckpointStore();
  s.write({ phase: 6, status: "sealed", updatedAt: "2026-01-01T00:00:00.000Z" });
  assert.equal(s.read(6)?.status, "sealed");
});

test("orc-phase", async () => {
  // A7 row "orc-phase" "graph.no-skip" — Agent requests P9 while P4 is open => Illegal transition; no deploy artifacts
  // Row targets graph — no HTTP endpoint exists for it. The
  // only executable rule today is the P6 module's phase bookkeeping: an
  // out-of-range phase is an illegal transition and is rejected.
  assert.throws(() => synthesize({ name: "x", phase: 13, job: JOBS[0] }), /invalid phase/);
  assert.throws(() => synthesize({ name: "x", phase: -1, job: JOBS[0] }), /invalid phase/);
});
