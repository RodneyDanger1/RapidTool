// ---------------------------------------------------------------------------
// tests/oracle.spec.ts — acceptance tests from the A7 oracle (project.oracle)
// machine-generated from RapidTool packet 59dc7817-0af9-4076-b3cc-2d6beecddbab; regenerate, don't hand-edit.
// REAL assertions, no todo stubs (fixes/135). Row ids are PINNED: the verify
// harness seeds + pins orc-* ids across runs (E-08) — never rename or drop
// one. Each test asserts what the emitted modules ACTUALLY do today:
//   * where the generated P6 module defines functions (the deterministic
//     template's synthesize/JOBS/REJECTION), those are asserted directly;
//   * store/api modules are asserted over their real exports;
//   * an oracle row whose target seam is a TODO(E-15) stub asserts the seam
//     rejects — that test FAILS the moment the seam is implemented, which is
//     the signal to replace it with the row's real acceptance assertion;
//   * an oracle row with NO emitted module surface to assert against (106
//     T-08 / F-05) is a MARKED, COUNTED skip under its pinned id — never an
//     always-true assertion, never a green test, and never a silent omission:
//     the row's own TAP line carries the NOT IMPLEMENTED marker and the total
//     is counted below and in README.md's oracle-row census;
//   * nothing here pretends a stub satisfies its brief.
// ORACLE SHORTFALL: 1 of 2 pinned A7 row(s) are
// NOT IMPLEMENTED — emitted below as MARKED skips under their pinned ids
// (each prints `# SKIP NOT IMPLEMENTED ...` on its own TAP line) and
// counted here and in README.md. The other 1 row(s) assert the
// emitted modules' real current behavior. A skip is not a pass: these rows
// carry no acceptance evidence until their seam (HTTP endpoint or P6 host)
// lands, and a spec whose live passes do not outnumber these skips is
// refused by the tree-run as a vacuous green (RT_E_SPEC_SKIP_VACUOUS).
// Run: node --experimental-strip-types --test tests/oracle.spec.ts
// ---------------------------------------------------------------------------
import { test } from "node:test";
import assert from "node:assert/strict";
import { CheckpointStore } from "../src/state/store.ts";
import { ENDPOINTS, route } from "../src/api/routes.ts";

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
  assert.deepEqual(ENDPOINTS, [{"method":"POST","path":"/v1/compute","job":"compute"}]);
});

// ---------------------------------------------------------------------------
// 4. Oracle rows (A7) — one test per row under its PINNED id; a row with no
// emitted module surface is a MARKED, COUNTED skip (`{ skip: ... }`, printed
// on its own TAP line) — never a green test and never a silent omission.
// ---------------------------------------------------------------------------

test("orc-1", async () => {
  // A7 row "orc-1" "job.compute.happy" — Authorized operator submits “compute” with a valid package => 200 + persisted entity + checkpoint written
  // Target seam: compute (POST /v1/compute). Today it is a TODO(E-15) stub —
  // the route rejects instead of returning "200 + persisted entity + checkpoint written". Asserting that real
  // current behavior: this test FAILS the moment compute is implemented,
  // which is the signal to replace it with the row's real acceptance assert.
  const ep = ENDPOINTS.find((e) => e.job === "compute");
  assert.ok(ep, "endpoint for the row's job must exist (contract drift)");
  await assert.rejects(route(ep.method, ep.path, {}), /RT_E_VALIDATION · TODO\(E-15\) stub/);
  // The "200 + persisted entity + checkpoint written" row expects a checkpoint write — the one part the real
  // CheckpointStore can satisfy today:
  const s = new CheckpointStore();
  s.write({ phase: 6, status: "sealed", updatedAt: "2026-01-01T00:00:00.000Z" });
  assert.equal(s.read(6)?.status, "sealed");
});

test("orc-phase", { skip: "NOT IMPLEMENTED - no emitted module surface targets this row yet (oracle shortfall, counted in README.md; a skip is not a pass)" }, () => {
  // A7 row "orc-phase" "graph.no-skip" — Agent requests P9 while P4 is open => Illegal transition; no deploy artifacts
  // NOT IMPLEMENTED (oracle shortfall — counted on the spec header and in
  // README.md): no emitted module surface targets this row yet (106
  // T-08 / F-05). The pre-fix emission asserted "orc-phase".length > 0 —
  // which cannot fail, so it was not evidence.
  // Replace the `{ skip: ... }` option with the row's real acceptance
  // assertion when the seam (HTTP endpoint or P6 host) lands — the skip
  // marker is the cue, and it is never counted as a pass.
});
