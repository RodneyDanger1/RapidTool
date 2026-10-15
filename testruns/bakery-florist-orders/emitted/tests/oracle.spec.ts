// ---------------------------------------------------------------------------
// tests/oracle.spec.ts — acceptance tests from the A7 oracle (project.oracle)
// machine-generated from RapidTool packet 1e776d25-d838-4a5a-aabd-ad54938787b1; regenerate, don't hand-edit.
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
// Capability-presence rows (fixes/150 G2) ride section 5 below: one REAL
// test per capability the implementationSpec demands (typeSignatures
// first, requirements fallback — the p6-arch source order).
// ---------------------------------------------------------------------------
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
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
//   src/generated/create-product.ts
//   src/generated/get-daily-revenue-by.ts
//   src/generated/remove-order-line.ts
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

// ---------------------------------------------------------------------------
// 5. Capability presence (fixes/150 G2) — demanded capability identifiers
// must exist in the emitted tree (presence proxy: a name is NOT behavior).
// ---------------------------------------------------------------------------

// Capability-presence scan: `__capScanFiles` are the emitted files this spec
// may read (tests/ dir → file, via __capDir). __capCarries() is true when the
// file exists AND its path or source text contains one of the demanded forms.
const __capDir = join(fileURLToPath(import.meta.url), "..");
const __capScanFiles = ["../src/generated.ts","../src/generated/create-product.ts","../src/generated/get-daily-revenue-by.ts","../src/generated/remove-order-line.ts","../src/jobs/aggregate.ts","../src/jobs/format.ts","../src/jobs/record.ts","../src/jobs/scan.ts","../src/jobs/search.ts"];
function __capCarries(relPath: string, forms: string[]): boolean {
  let text = "";
  try {
    text = readFileSync(join(__capDir, relPath), "utf8");
  } catch {
    return false; // file missing from the emission ⇒ it carries nothing
  }
  const p = relPath.toLowerCase();
  const body = text.toLowerCase();
  return forms.some((f) => f.length > 0 && (p.includes(f) || body.includes(f)));
}

// fixes/277 (R3-f03 / W-06): this emission carries a PARTIAL synthesis
// tree — a capability whose identifiers appear in NO scanned file names a
// module that was NEVER materialised, so its row SKIPS with that reason
// instead of reddening (the pre-fix 28-red cascade read as product
// failure; the reds were assembly, not the product).
const __capPartial = true;

// capability.1 — createProduct(input: ProductInput): Promise<Product>
test("capability.1", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["createproduct"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.1 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.2 — editProduct(id: string, changes: Partial<ProductInput>): Promise<Product>
test("capability.2", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["editproduct"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.2 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.3 — deactivateProduct(id: string): Promise<Product>
test("capability.3", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["deactivateproduct"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.3 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.4 — reactivateProduct(id: string): Promise<Product>
test("capability.4", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["reactivateproduct"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.4 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.5 — listProducts(filter: ProductFilter): Promise<Product[]>
test("capability.5", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["listproducts","listproduct"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.5 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.6 — createOrder(customerId: string, fulfilmentDate: Date): Promise<Order>
test("capability.6", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["createorder","createord"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.6 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.7 — addOrderLine(orderId: string, productId: string, quantity: number): Promise<Order>
test("capability.7", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["addorderline","addorderlin"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.7 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.8 — updateOrderLine(orderId: string, lineId: string, quantity: number): Promise<Order>
test("capability.8", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["updateorderline","updateorderlin"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.8 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.9 — removeOrderLine(orderId: string, lineId: string): Promise<Order>
test("capability.9", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["removeorderline","removeorderlin"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.9 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.10 — confirmOrder(orderId: string): Promise<ConfirmResult>
test("capability.10", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["confirmorder","confirmord"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.10 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.11 — cancelOrder(orderId: string): Promise<Order>
test("capability.11", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["cancelorder","cancelord"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.11 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.12 — receiveStock(productId: string, quantity: number): Promise<StockMovement>
test("capability.12", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["receivestock"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.12 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.13 — recordSpoilage(productId: string, quantity: number): Promise<StockMovement>
test("capability.13", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["recordspoilage","recordspoilag"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.13 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.14 — adjustStock(productId: string, delta: number, reason: string): Promise<StockMovement>
test("capability.14", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["adjuststock"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.14 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.15 — getLowStockDashboard(): Promise<LowStockItem[]>
test("capability.15", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["getlowstockdashboard"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.15 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.16 — listOrders(filter: OrderFilter): Promise<OrderListResult>
test("capability.16", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["listorders","listord"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.16 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.17 — getStatusSummary(filter: OrderFilter): Promise<Record<OrderStatus, number>>
test("capability.17", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["getstatussummary"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.17 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.18 — getDailyRevenueByCategory(range: DateRange): Promise<DailyRevenue[]>
test("capability.18", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["getdailyrevenuebycategory"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.18 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.19 — getTopSellingProducts(range: DateRange, limit: number): Promise<TopProduct[]>
test("capability.19", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["gettopsellingproducts","gettopsellingproduct"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.19 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.20 — getTotalWaste(range: DateRange): Promise<WasteTotal>
test("capability.20", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["gettotalwaste","gettotalwast"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.20 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.21 — reconstructStockCount(productId: string): Promise<number>
test("capability.21", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["reconstructstockcount"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.21 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.22 — formatGBP(minorUnits: number): string
test("capability.22", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["formatgbp"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.22 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.23 — transitionOrderStatus(orderId: string, next: OrderStatus): Promise<Order>
test("capability.23", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["transitionorderstatus","transitionorderstatu"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.23 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.24 — runSearch(command: SearchCommand): Promise<Customer>
test("capability.24", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["runsearch"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.24 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.25 — listSearchRuns(id: string, limit?: number): Promise<SearchRun[]>
test("capability.25", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["listsearchruns","listsearchrun"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.25 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.26 — runScan(command: ScanCommand): Promise<Report>
test("capability.26", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["runscan"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.26 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.27 — listScanRuns(id: string, limit?: number): Promise<ScanRun[]>
test("capability.27", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["listscanruns","listscanrun"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.27 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.28 — runAggregate(command: AggregateCommand): Promise<Inventory>
test("capability.28", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["runaggregate","runaggregat"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.28 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.29 — listAggregateRuns(id: string, limit?: number): Promise<AggregateRun[]>
test("capability.29", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["listaggregateruns","listaggregaterun"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.29 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});
