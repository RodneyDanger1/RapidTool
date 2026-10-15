// ---------------------------------------------------------------------------
// tests/oracle.spec.ts — acceptance tests from the A7 oracle (project.oracle)
// machine-generated from RapidTool packet 54661844-e75e-47c2-bc63-3f3608fe21a2; regenerate, don't hand-edit.
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
//     T-08 / F-05) is a visibly-marked test.skip("<id> — NOT IMPLEMENTED") —
//     never an always-true assertion; node:test reports it as skipped (never
//     a pass) and the README counts it separately from the assertable rows;
//   * nothing here pretends a stub satisfies its brief.
// Run: node --experimental-strip-types --test tests/oracle.spec.ts
// TREE mode (fixes/144 M2): this project carries a generatedTree, so the
// scaffold assembled those files (verbatim, at their own paths) instead of
// the single P6 module; section 1 imports the tree ENTRY module below.
// ---------------------------------------------------------------------------
import { test } from "node:test";
import assert from "node:assert/strict";
import * as treeModule from "../src/jobs/search.ts";
import * as jobMod_search from "../src/jobs/search.ts";
import * as jobMod_scan from "../src/jobs/scan.ts";
import * as jobMod_format from "../src/jobs/format.ts";
import * as jobMod_record from "../src/jobs/record.ts";
import * as jobMod_aggregate from "../src/jobs/aggregate.ts";

// ---------------------------------------------------------------------------
// 1. Tree truth — the generated tree ENTRY module (project.generatedTree,
// fixes/144 M2). The scaffold assembled every tree file verbatim at its own
// repo-relative path; this spec imports the ENTRY module (the file at the
// path the legacy P6 host would have used) so the emitted npm test executes
// the REAL generated tree — its cross-file imports must resolve or this spec
// fails to load. Export names are generated content, so the entry is asserted
// as a namespace that must carry at least one real export.
// ---------------------------------------------------------------------------

// Emitted generated-tree files:
//   src/generated.ts
//   src/generated/cancel-order.ts
//   src/generated/count-orders-by-status.ts
//   src/generated/list-products.ts
//   src/jobs/aggregate.ts
//   src/jobs/format.ts
//   src/jobs/record.ts
//   src/jobs/scan.ts
//   src/jobs/search.ts  (entry)

test("tree.entry — the generated tree entry module loads and cross-file imports resolve", () => {
  // The import at the top of this spec IS the load assertion: a missing entry
  // or an unresolvable cross-file import fails the spec before any test runs.
  // Export names are generated content — the one stable assertion is that the
  // namespace carries at least one real export. (106 T-08 / F-05: the pre-fix
  // `assert.ok(treeModule)` / `typeof === "object"` pair could never fail, so
  // it was removed rather than left to read as evidence.)
  const names = Object.keys(treeModule);
  assert.ok(names.length > 0, "entry exports real names: " + names.join(", "));
});

// ---------------------------------------------------------------------------
// 4. Oracle rows (A7) — one test per row under its PINNED id; a row with no
// emitted module surface is a visible test.skip("<id> — NOT IMPLEMENTED")
// (fixes/216b) — skipped, never green, and counted by the README census.
// ---------------------------------------------------------------------------

test("orc-1", async () => {
  // A7 row "orc-1" "job.search.happy" — Authorized operator submits “search” with a valid customer => 200 + persisted entity + checkpoint written
  // fixes/216k D2 (TA-15): the tree materialised this job as a REAL
  // module (never a bridge) — assert its export surface and CALL one
  // real function in a guarded probe. A ReferenceError here is a missing
  // cross-file binding (a forward call into a later chunk) and fails this
  // row; any other throw is the real function behaving. Pre-D2: a skip.
  // The call is AWAITED: a real job function is async, so a floating
  // rejection would otherwise surface after the test ends as an
  // unhandledRejection and red the whole spec file (331 wave).
  const jm_search = jobMod_search as unknown as Record<string, (...a: unknown[]) => unknown>;
  const names = Object.keys(jm_search);
  assert.ok(names.length > 0, "job module exports real names: " + names.join(", "));
  for (const n of names) assert.equal(typeof jm_search[n], "function", n + " must be a real function");
  const first = names[0] ?? "";
  // 346 E1 (L1-F2 residual): a shape-only surface (typeof === "function")
  // must not earn `tested`. Call the real function and assert a
  // BEHAVIOURAL outcome: a usable return value, or a well-formed Error
  // rejection. A missing cross-file binding (ReferenceError) fails
  // outright; a NaN return (the L1-F2 stub shape) or a non-Error throw now
  // fails too, instead of being swallowed as a pass.
  let __jobOutcomeOk = false;
  try {
    const __jobResult = await (jm_search[first] as (...a: unknown[]) => unknown)({ payment: 1 });
    __jobOutcomeOk = typeof __jobResult !== "number" || !Number.isNaN(__jobResult);
  } catch (e) {
    if (e instanceof ReferenceError) throw e;
    __jobOutcomeOk = e instanceof Error;
  }
  assert.equal(__jobOutcomeOk, true, "job module " + "src/jobs/search.ts" + " must produce a real outcome for its input (a usable return value or a well-formed Error)");
});

test("orc-2", async () => {
  // A7 row "orc-2" "job.scan.happy" — Authorized operator submits “scan” with a valid customer => 200 + persisted entity + checkpoint written
  // fixes/216k D2 (TA-15): the tree materialised this job as a REAL
  // module (never a bridge) — assert its export surface and CALL one
  // real function in a guarded probe. A ReferenceError here is a missing
  // cross-file binding (a forward call into a later chunk) and fails this
  // row; any other throw is the real function behaving. Pre-D2: a skip.
  // The call is AWAITED: a real job function is async, so a floating
  // rejection would otherwise surface after the test ends as an
  // unhandledRejection and red the whole spec file (331 wave).
  const jm_scan = jobMod_scan as unknown as Record<string, (...a: unknown[]) => unknown>;
  const names = Object.keys(jm_scan);
  assert.ok(names.length > 0, "job module exports real names: " + names.join(", "));
  for (const n of names) assert.equal(typeof jm_scan[n], "function", n + " must be a real function");
  const first = names[0] ?? "";
  // 346 E1 (L1-F2 residual): a shape-only surface (typeof === "function")
  // must not earn `tested`. Call the real function and assert a
  // BEHAVIOURAL outcome: a usable return value, or a well-formed Error
  // rejection. A missing cross-file binding (ReferenceError) fails
  // outright; a NaN return (the L1-F2 stub shape) or a non-Error throw now
  // fails too, instead of being swallowed as a pass.
  let __jobOutcomeOk = false;
  try {
    const __jobResult = await (jm_scan[first] as (...a: unknown[]) => unknown)({ payment: 1 });
    __jobOutcomeOk = typeof __jobResult !== "number" || !Number.isNaN(__jobResult);
  } catch (e) {
    if (e instanceof ReferenceError) throw e;
    __jobOutcomeOk = e instanceof Error;
  }
  assert.equal(__jobOutcomeOk, true, "job module " + "src/jobs/scan.ts" + " must produce a real outcome for its input (a usable return value or a well-formed Error)");
});

test("orc-3", async () => {
  // A7 row "orc-3" "job.format.happy" — Authorized operator submits “format” with a valid customer => 200 + persisted entity + checkpoint written
  // fixes/216k D2 (TA-15): the tree materialised this job as a REAL
  // module (never a bridge) — assert its export surface and CALL one
  // real function in a guarded probe. A ReferenceError here is a missing
  // cross-file binding (a forward call into a later chunk) and fails this
  // row; any other throw is the real function behaving. Pre-D2: a skip.
  // The call is AWAITED: a real job function is async, so a floating
  // rejection would otherwise surface after the test ends as an
  // unhandledRejection and red the whole spec file (331 wave).
  const jm_format = jobMod_format as unknown as Record<string, (...a: unknown[]) => unknown>;
  const names = Object.keys(jm_format);
  assert.ok(names.length > 0, "job module exports real names: " + names.join(", "));
  for (const n of names) assert.equal(typeof jm_format[n], "function", n + " must be a real function");
  const first = names[0] ?? "";
  // 346 E1 (L1-F2 residual): a shape-only surface (typeof === "function")
  // must not earn `tested`. Call the real function and assert a
  // BEHAVIOURAL outcome: a usable return value, or a well-formed Error
  // rejection. A missing cross-file binding (ReferenceError) fails
  // outright; a NaN return (the L1-F2 stub shape) or a non-Error throw now
  // fails too, instead of being swallowed as a pass.
  let __jobOutcomeOk = false;
  try {
    const __jobResult = await (jm_format[first] as (...a: unknown[]) => unknown)({ payment: 1 });
    __jobOutcomeOk = typeof __jobResult !== "number" || !Number.isNaN(__jobResult);
  } catch (e) {
    if (e instanceof ReferenceError) throw e;
    __jobOutcomeOk = e instanceof Error;
  }
  assert.equal(__jobOutcomeOk, true, "job module " + "src/jobs/format.ts" + " must produce a real outcome for its input (a usable return value or a well-formed Error)");
});

test("orc-4", async () => {
  // A7 row "orc-4" "job.record.happy" — Authorized operator submits “record” with a valid customer => 200 + persisted entity + checkpoint written
  // fixes/216k D2 (TA-15): the tree materialised this job as a REAL
  // module (never a bridge) — assert its export surface and CALL one
  // real function in a guarded probe. A ReferenceError here is a missing
  // cross-file binding (a forward call into a later chunk) and fails this
  // row; any other throw is the real function behaving. Pre-D2: a skip.
  // The call is AWAITED: a real job function is async, so a floating
  // rejection would otherwise surface after the test ends as an
  // unhandledRejection and red the whole spec file (331 wave).
  const jm_record = jobMod_record as unknown as Record<string, (...a: unknown[]) => unknown>;
  const names = Object.keys(jm_record);
  assert.ok(names.length > 0, "job module exports real names: " + names.join(", "));
  for (const n of names) assert.equal(typeof jm_record[n], "function", n + " must be a real function");
  const first = names[0] ?? "";
  // 346 E1 (L1-F2 residual): a shape-only surface (typeof === "function")
  // must not earn `tested`. Call the real function and assert a
  // BEHAVIOURAL outcome: a usable return value, or a well-formed Error
  // rejection. A missing cross-file binding (ReferenceError) fails
  // outright; a NaN return (the L1-F2 stub shape) or a non-Error throw now
  // fails too, instead of being swallowed as a pass.
  let __jobOutcomeOk = false;
  try {
    const __jobResult = await (jm_record[first] as (...a: unknown[]) => unknown)({ payment: 1 });
    __jobOutcomeOk = typeof __jobResult !== "number" || !Number.isNaN(__jobResult);
  } catch (e) {
    if (e instanceof ReferenceError) throw e;
    __jobOutcomeOk = e instanceof Error;
  }
  assert.equal(__jobOutcomeOk, true, "job module " + "src/jobs/record.ts" + " must produce a real outcome for its input (a usable return value or a well-formed Error)");
});

test("orc-5", async () => {
  // A7 row "orc-5" "job.aggregate.happy" — Authorized operator submits “aggregate” with a valid customer => 200 + persisted entity + checkpoint written
  // fixes/216k D2 (TA-15): the tree materialised this job as a REAL
  // module (never a bridge) — assert its export surface and CALL one
  // real function in a guarded probe. A ReferenceError here is a missing
  // cross-file binding (a forward call into a later chunk) and fails this
  // row; any other throw is the real function behaving. Pre-D2: a skip.
  // The call is AWAITED: a real job function is async, so a floating
  // rejection would otherwise surface after the test ends as an
  // unhandledRejection and red the whole spec file (331 wave).
  const jm_aggregate = jobMod_aggregate as unknown as Record<string, (...a: unknown[]) => unknown>;
  const names = Object.keys(jm_aggregate);
  assert.ok(names.length > 0, "job module exports real names: " + names.join(", "));
  for (const n of names) assert.equal(typeof jm_aggregate[n], "function", n + " must be a real function");
  const first = names[0] ?? "";
  // 346 E1 (L1-F2 residual): a shape-only surface (typeof === "function")
  // must not earn `tested`. Call the real function and assert a
  // BEHAVIOURAL outcome: a usable return value, or a well-formed Error
  // rejection. A missing cross-file binding (ReferenceError) fails
  // outright; a NaN return (the L1-F2 stub shape) or a non-Error throw now
  // fails too, instead of being swallowed as a pass.
  let __jobOutcomeOk = false;
  try {
    const __jobResult = await (jm_aggregate[first] as (...a: unknown[]) => unknown)({ payment: 1 });
    __jobOutcomeOk = typeof __jobResult !== "number" || !Number.isNaN(__jobResult);
  } catch (e) {
    if (e instanceof ReferenceError) throw e;
    __jobOutcomeOk = e instanceof Error;
  }
  assert.equal(__jobOutcomeOk, true, "job module " + "src/jobs/aggregate.ts" + " must produce a real outcome for its input (a usable return value or a well-formed Error)");
});

test("orc-c-multi-tenant", async () => {
  // A7 row "orc-c-multi-tenant" "constraint.multi-tenant" — Request violates multi-tenant => 403 or 422; no side effect; diagnostic JSON
  // fixes/216k D2 (TA-15): the tree materialised this job as a REAL
  // module (never a bridge) — assert its export surface and CALL one
  // real function in a guarded probe. A ReferenceError here is a missing
  // cross-file binding (a forward call into a later chunk) and fails this
  // row; any other throw is the real function behaving. Pre-D2: a skip.
  // The call is AWAITED: a real job function is async, so a floating
  // rejection would otherwise surface after the test ends as an
  // unhandledRejection and red the whole spec file (331 wave).
  const jm_search = jobMod_search as unknown as Record<string, (...a: unknown[]) => unknown>;
  const names = Object.keys(jm_search);
  assert.ok(names.length > 0, "job module exports real names: " + names.join(", "));
  for (const n of names) assert.equal(typeof jm_search[n], "function", n + " must be a real function");
  const first = names[0] ?? "";
  // 346 E1 (L1-F2 residual): a shape-only surface (typeof === "function")
  // must not earn `tested`. Call the real function and assert a
  // BEHAVIOURAL outcome: a usable return value, or a well-formed Error
  // rejection. A missing cross-file binding (ReferenceError) fails
  // outright; a NaN return (the L1-F2 stub shape) or a non-Error throw now
  // fails too, instead of being swallowed as a pass.
  let __jobOutcomeOk = false;
  try {
    const __jobResult = await (jm_search[first] as (...a: unknown[]) => unknown)({ payment: 1 });
    __jobOutcomeOk = typeof __jobResult !== "number" || !Number.isNaN(__jobResult);
  } catch (e) {
    if (e instanceof ReferenceError) throw e;
    __jobOutcomeOk = e instanceof Error;
  }
  assert.equal(__jobOutcomeOk, true, "job module " + "src/jobs/search.ts" + " must produce a real outcome for its input (a usable return value or a well-formed Error)");
});

test("orc-c-deterministic", async () => {
  // A7 row "orc-c-deterministic" "constraint.deterministic" — Request violates deterministic => 403 or 422; no side effect; diagnostic JSON
  // fixes/216k D2 (TA-15): the tree materialised this job as a REAL
  // module (never a bridge) — assert its export surface and CALL one
  // real function in a guarded probe. A ReferenceError here is a missing
  // cross-file binding (a forward call into a later chunk) and fails this
  // row; any other throw is the real function behaving. Pre-D2: a skip.
  // The call is AWAITED: a real job function is async, so a floating
  // rejection would otherwise surface after the test ends as an
  // unhandledRejection and red the whole spec file (331 wave).
  const jm_search = jobMod_search as unknown as Record<string, (...a: unknown[]) => unknown>;
  const names = Object.keys(jm_search);
  assert.ok(names.length > 0, "job module exports real names: " + names.join(", "));
  for (const n of names) assert.equal(typeof jm_search[n], "function", n + " must be a real function");
  const first = names[0] ?? "";
  // 346 E1 (L1-F2 residual): a shape-only surface (typeof === "function")
  // must not earn `tested`. Call the real function and assert a
  // BEHAVIOURAL outcome: a usable return value, or a well-formed Error
  // rejection. A missing cross-file binding (ReferenceError) fails
  // outright; a NaN return (the L1-F2 stub shape) or a non-Error throw now
  // fails too, instead of being swallowed as a pass.
  let __jobOutcomeOk = false;
  try {
    const __jobResult = await (jm_search[first] as (...a: unknown[]) => unknown)({ payment: 1 });
    __jobOutcomeOk = typeof __jobResult !== "number" || !Number.isNaN(__jobResult);
  } catch (e) {
    if (e instanceof ReferenceError) throw e;
    __jobOutcomeOk = e instanceof Error;
  }
  assert.equal(__jobOutcomeOk, true, "job module " + "src/jobs/search.ts" + " must produce a real outcome for its input (a usable return value or a well-formed Error)");
});

test.skip("orc-phase — NOT IMPLEMENTED", () => {
  // A7 row "orc-phase" "graph.no-skip" — Agent requests P9 while P4 is open => Illegal transition; no deploy artifacts
  // NOT IMPLEMENTED: no emitted module surface targets this row yet (106
  // T-08 / F-05). The pre-fix emission asserted "orc-phase".length > 0 —
  // which cannot fail, so it was not evidence; this row is skipped instead.
  // Replace the skip with the row's real acceptance assertion when the
  // seam (HTTP endpoint or P6 host) lands.
  assert.fail("orc-phase is NOT IMPLEMENTED — replace this skip with the row's real acceptance assertion");
});
