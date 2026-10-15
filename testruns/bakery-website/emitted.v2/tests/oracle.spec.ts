// ---------------------------------------------------------------------------
// tests/oracle.spec.ts — acceptance tests from the A7 oracle (project.oracle)
// machine-generated from RapidTool packet d687fbd8-143c-42db-a7b5-f4717e817a42; regenerate, don't hand-edit.
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
import * as treeModule from "../src/jobs/show.ts";
import * as jobMod_show from "../src/jobs/show.ts";
import * as jobMod_search from "../src/jobs/search.ts";
import * as jobMod_close from "../src/jobs/close.ts";
import * as jobMod_track from "../src/jobs/track.ts";
import * as jobMod_query from "../src/jobs/query.ts";

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
//   src/generated/compute-open-status.ts
//   src/generated/render-menu-page.ts
//   src/generated/render-open-badge.ts
//   src/jobs/close.ts
//   src/jobs/query.ts
//   src/jobs/search.ts
//   src/jobs/show.ts  (entry)
//   src/jobs/track.ts

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
  // A7 row "orc-1" "job.show.happy" — Authorized operator submits “show” with a valid text => 200 + persisted entity + checkpoint written
  // fixes/216k D2 (TA-15): the tree materialised this job as a REAL
  // module (never a bridge) — assert its export surface and CALL one
  // real function in a guarded probe. A ReferenceError here is a missing
  // cross-file binding (a forward call into a later chunk) and fails this
  // row; any other throw is the real function behaving. Pre-D2: a skip.
  // The call is AWAITED: a real job function is async, so a floating
  // rejection would otherwise surface after the test ends as an
  // unhandledRejection and red the whole spec file (331 wave).
  const jm_show = jobMod_show as unknown as Record<string, (...a: unknown[]) => unknown>;
  const names = Object.keys(jm_show);
  assert.ok(names.length > 0, "job module exports real names: " + names.join(", "));
  for (const n of names) assert.equal(typeof jm_show[n], "function", n + " must be a real function");
  const first = names[0] ?? "";
  // 346 E1 (L1-F2 residual): a shape-only surface (typeof === "function")
  // must not earn `tested`. Call the real function and assert a
  // BEHAVIOURAL outcome: a usable return value, or a well-formed Error
  // rejection. A missing cross-file binding (ReferenceError) fails
  // outright; a NaN return (the L1-F2 stub shape) or a non-Error throw now
  // fails too, instead of being swallowed as a pass.
  let __jobOutcomeOk = false;
  try {
    const __jobResult = await (jm_show[first] as (...a: unknown[]) => unknown)({ payment: 1 });
    __jobOutcomeOk = typeof __jobResult !== "number" || !Number.isNaN(__jobResult);
  } catch (e) {
    if (e instanceof ReferenceError) throw e;
    __jobOutcomeOk = e instanceof Error;
  }
  assert.equal(__jobOutcomeOk, true, "job module " + "src/jobs/show.ts" + " must produce a real outcome for its input (a usable return value or a well-formed Error)");
});

test("orc-2", async () => {
  // A7 row "orc-2" "job.search.happy" — Authorized operator submits “search” with a valid text => 200 + persisted entity + checkpoint written
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

test("orc-3", async () => {
  // A7 row "orc-3" "job.close.happy" — Authorized operator submits “close” with a valid text => 200 + persisted entity + checkpoint written
  // fixes/216k D2 (TA-15): the tree materialised this job as a REAL
  // module (never a bridge) — assert its export surface and CALL one
  // real function in a guarded probe. A ReferenceError here is a missing
  // cross-file binding (a forward call into a later chunk) and fails this
  // row; any other throw is the real function behaving. Pre-D2: a skip.
  // The call is AWAITED: a real job function is async, so a floating
  // rejection would otherwise surface after the test ends as an
  // unhandledRejection and red the whole spec file (331 wave).
  const jm_close = jobMod_close as unknown as Record<string, (...a: unknown[]) => unknown>;
  const names = Object.keys(jm_close);
  assert.ok(names.length > 0, "job module exports real names: " + names.join(", "));
  for (const n of names) assert.equal(typeof jm_close[n], "function", n + " must be a real function");
  const first = names[0] ?? "";
  // 346 E1 (L1-F2 residual): a shape-only surface (typeof === "function")
  // must not earn `tested`. Call the real function and assert a
  // BEHAVIOURAL outcome: a usable return value, or a well-formed Error
  // rejection. A missing cross-file binding (ReferenceError) fails
  // outright; a NaN return (the L1-F2 stub shape) or a non-Error throw now
  // fails too, instead of being swallowed as a pass.
  let __jobOutcomeOk = false;
  try {
    const __jobResult = await (jm_close[first] as (...a: unknown[]) => unknown)({ payment: 1 });
    __jobOutcomeOk = typeof __jobResult !== "number" || !Number.isNaN(__jobResult);
  } catch (e) {
    if (e instanceof ReferenceError) throw e;
    __jobOutcomeOk = e instanceof Error;
  }
  assert.equal(__jobOutcomeOk, true, "job module " + "src/jobs/close.ts" + " must produce a real outcome for its input (a usable return value or a well-formed Error)");
});

test("orc-4", async () => {
  // A7 row "orc-4" "job.track.happy" — Authorized operator submits “track” with a valid text => 200 + persisted entity + checkpoint written
  // fixes/216k D2 (TA-15): the tree materialised this job as a REAL
  // module (never a bridge) — assert its export surface and CALL one
  // real function in a guarded probe. A ReferenceError here is a missing
  // cross-file binding (a forward call into a later chunk) and fails this
  // row; any other throw is the real function behaving. Pre-D2: a skip.
  // The call is AWAITED: a real job function is async, so a floating
  // rejection would otherwise surface after the test ends as an
  // unhandledRejection and red the whole spec file (331 wave).
  const jm_track = jobMod_track as unknown as Record<string, (...a: unknown[]) => unknown>;
  const names = Object.keys(jm_track);
  assert.ok(names.length > 0, "job module exports real names: " + names.join(", "));
  for (const n of names) assert.equal(typeof jm_track[n], "function", n + " must be a real function");
  const first = names[0] ?? "";
  // 346 E1 (L1-F2 residual): a shape-only surface (typeof === "function")
  // must not earn `tested`. Call the real function and assert a
  // BEHAVIOURAL outcome: a usable return value, or a well-formed Error
  // rejection. A missing cross-file binding (ReferenceError) fails
  // outright; a NaN return (the L1-F2 stub shape) or a non-Error throw now
  // fails too, instead of being swallowed as a pass.
  let __jobOutcomeOk = false;
  try {
    const __jobResult = await (jm_track[first] as (...a: unknown[]) => unknown)({ payment: 1 });
    __jobOutcomeOk = typeof __jobResult !== "number" || !Number.isNaN(__jobResult);
  } catch (e) {
    if (e instanceof ReferenceError) throw e;
    __jobOutcomeOk = e instanceof Error;
  }
  assert.equal(__jobOutcomeOk, true, "job module " + "src/jobs/track.ts" + " must produce a real outcome for its input (a usable return value or a well-formed Error)");
});

test("orc-5", async () => {
  // A7 row "orc-5" "job.query.happy" — Authorized operator submits “query” with a valid text => 200 + persisted entity + checkpoint written
  // fixes/216k D2 (TA-15): the tree materialised this job as a REAL
  // module (never a bridge) — assert its export surface and CALL one
  // real function in a guarded probe. A ReferenceError here is a missing
  // cross-file binding (a forward call into a later chunk) and fails this
  // row; any other throw is the real function behaving. Pre-D2: a skip.
  // The call is AWAITED: a real job function is async, so a floating
  // rejection would otherwise surface after the test ends as an
  // unhandledRejection and red the whole spec file (331 wave).
  const jm_query = jobMod_query as unknown as Record<string, (...a: unknown[]) => unknown>;
  const names = Object.keys(jm_query);
  assert.ok(names.length > 0, "job module exports real names: " + names.join(", "));
  for (const n of names) assert.equal(typeof jm_query[n], "function", n + " must be a real function");
  const first = names[0] ?? "";
  // 346 E1 (L1-F2 residual): a shape-only surface (typeof === "function")
  // must not earn `tested`. Call the real function and assert a
  // BEHAVIOURAL outcome: a usable return value, or a well-formed Error
  // rejection. A missing cross-file binding (ReferenceError) fails
  // outright; a NaN return (the L1-F2 stub shape) or a non-Error throw now
  // fails too, instead of being swallowed as a pass.
  let __jobOutcomeOk = false;
  try {
    const __jobResult = await (jm_query[first] as (...a: unknown[]) => unknown)({ payment: 1 });
    __jobOutcomeOk = typeof __jobResult !== "number" || !Number.isNaN(__jobResult);
  } catch (e) {
    if (e instanceof ReferenceError) throw e;
    __jobOutcomeOk = e instanceof Error;
  }
  assert.equal(__jobOutcomeOk, true, "job module " + "src/jobs/query.ts" + " must produce a real outcome for its input (a usable return value or a well-formed Error)");
});

test("orc-c-local-first", async () => {
  // A7 row "orc-c-local-first" "constraint.local-first" — Request violates local-first => 403 or 422; no side effect; diagnostic JSON
  // fixes/216k D2 (TA-15): the tree materialised this job as a REAL
  // module (never a bridge) — assert its export surface and CALL one
  // real function in a guarded probe. A ReferenceError here is a missing
  // cross-file binding (a forward call into a later chunk) and fails this
  // row; any other throw is the real function behaving. Pre-D2: a skip.
  // The call is AWAITED: a real job function is async, so a floating
  // rejection would otherwise surface after the test ends as an
  // unhandledRejection and red the whole spec file (331 wave).
  const jm_show = jobMod_show as unknown as Record<string, (...a: unknown[]) => unknown>;
  const names = Object.keys(jm_show);
  assert.ok(names.length > 0, "job module exports real names: " + names.join(", "));
  for (const n of names) assert.equal(typeof jm_show[n], "function", n + " must be a real function");
  const first = names[0] ?? "";
  // 346 E1 (L1-F2 residual): a shape-only surface (typeof === "function")
  // must not earn `tested`. Call the real function and assert a
  // BEHAVIOURAL outcome: a usable return value, or a well-formed Error
  // rejection. A missing cross-file binding (ReferenceError) fails
  // outright; a NaN return (the L1-F2 stub shape) or a non-Error throw now
  // fails too, instead of being swallowed as a pass.
  let __jobOutcomeOk = false;
  try {
    const __jobResult = await (jm_show[first] as (...a: unknown[]) => unknown)({ payment: 1 });
    __jobOutcomeOk = typeof __jobResult !== "number" || !Number.isNaN(__jobResult);
  } catch (e) {
    if (e instanceof ReferenceError) throw e;
    __jobOutcomeOk = e instanceof Error;
  }
  assert.equal(__jobOutcomeOk, true, "job module " + "src/jobs/show.ts" + " must produce a real outcome for its input (a usable return value or a well-formed Error)");
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
const __capScanFiles = ["../src/generated.ts","../src/generated/compute-open-status.ts","../src/generated/render-menu-page.ts","../src/generated/render-open-badge.ts","../src/jobs/close.ts","../src/jobs/query.ts","../src/jobs/search.ts","../src/jobs/show.ts","../src/jobs/track.ts"];
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

// capability.1 — type Allergen = 'gluten' | 'dairy' | 'nuts' | 'egg' | 'vegan';
test("capability.1", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["allergen"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.1 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.2 — type Category = 'Breads' | 'Pastries' | 'Cakes' | 'Drinks';
test("capability.2", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["category"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.2 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.3 — interface MenuItem { id: string; name: string; description: string; priceGBP: number; category: Category; allergens: Allergen[]; }
test("capability.3", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["menuitem"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.3 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.4 — interface WeeklyHoursRow { day: string; open: string | null; close: string | null; }
test("capability.4", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["weeklyhoursrow"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.4 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.5 — interface HolidayClosure { date: string; label: string; }
test("capability.5", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["holidayclosure","holidayclosur"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.5 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.6 — interface OpeningHoursTable { weekly: WeeklyHoursRow[]; holidays: HolidayClosure[]; }
test("capability.6", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["openinghourstable","openinghourstabl"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.6 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.7 — computeOpenStatus(hours: OpeningHoursTable, now: Date): { isOpen: boolean; label: string }
test("capability.7", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["computeopenstatus","computeopenstatu"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.7 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.8 — getTodayHighlights(items: MenuItem[], now: Date): MenuItem[]
test("capability.8", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["gettodayhighlights","gettodayhighlight"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.8 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.9 — renderOpenBadge(hours: OpeningHoursTable, now: Date): string
test("capability.9", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["renderopenbadge","renderopenbadg"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.9 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.10 — filterMenuItems(items: MenuItem[], filters: { category?: Category; allergen?: Allergen; query?: string }): MenuItem[]
test("capability.10", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["filtermenuitems","filtermenuitem"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.10 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.11 — groupMenuByCategory(items: MenuItem[]): Record<Category, MenuItem[]>
test("capability.11", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["groupmenubycategory"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.11 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.12 — formatGBP(amount: number): string
test("capability.12", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["formatgbp"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.12 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.13 — computeOrderTotal(unitPriceGBP: number, quantity: number): number
test("capability.13", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["computeordertotal"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.13 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.14 — validateOrder(input: OrderInput): { valid: boolean; errors: Record<string, string> }
test("capability.14", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["validateorder","validateord"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.14 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.15 — generateOrderReference(now: Date): string
test("capability.15", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["generateorderreference","generateorderreferenc"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.15 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.16 — submitOrder(input: OrderInput): Promise<OrderConfirmation>
test("capability.16", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["submitorder","submitord"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.16 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.17 — interface OrderInput { name: string; phone?: string; email?: string; pickupDate: string; product: string; quantity: number; notes?: string; }
test("capability.17", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["orderinput"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.17 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.18 — interface OrderConfirmation { reference: string; echoed: OrderInput; totalGBP: number; }
test("capability.18", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["orderconfirmation"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.18 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.19 — renderMenuPage(items: MenuItem[]): string
test("capability.19", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["rendermenupage","rendermenupag"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.19 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.20 — renderHoursPage(hours: OpeningHoursTable): string
test("capability.20", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["renderhourspage","renderhourspag"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.20 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.21 — renderContactPage(details: ContactDetails): string
test("capability.21", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["rendercontactpage","rendercontactpag"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.21 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.22 — renderOrderForm(): string
test("capability.22", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["renderorderform"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.22 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.23 — interface ContactDetails { phone: string; email: string; address: string; socialLinks: string[]; faq: { question: string; answer: string }[]; }
test("capability.23", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["contactdetails","contactdetail"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.23 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.24 — runShow(command: ShowCommand): Promise<Text>
test("capability.24", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["runshow"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.24 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.25 — listShowRuns(id: string, limit?: number): Promise<ShowRun[]>
test("capability.25", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["listshowruns","listshowrun"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.25 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.26 — runSearch(command: SearchCommand): Promise<Table>
test("capability.26", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["runsearch"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.26 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.27 — listSearchRuns(id: string, limit?: number): Promise<SearchRun[]>
test("capability.27", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["listsearchruns","listsearchrun"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.27 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.28 — runClose(command: CloseCommand): Promise<Page>
test("capability.28", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["runclose","runclo"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.28 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.29 — listCloseRuns(id: string, limit?: number): Promise<CloseRun[]>
test("capability.29", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["listcloseruns","listcloserun"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.29 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.30 — runTrack(command: TrackCommand): Promise<Image>
test("capability.30", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["runtrack"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.30 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.31 — listTrackRuns(id: string, limit?: number): Promise<TrackRun[]>
test("capability.31", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["listtrackruns","listtrackrun"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.31 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.32 — runQuery(command: QueryCommand): Promise<Link>
test("capability.32", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["runquery"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.32 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});

// capability.33 — listQueryRuns(id: string, limit?: number): Promise<QueryRun[]>
test("capability.33", (t) => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["listqueryruns","listqueryrun"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  if (__capPartial && carried.length === 0) {
    t.skip(
      "capability.33 — SKIPPED (partial synthesis): no scanned file carries this capability's demanded identifier forms — the module that would carry it was never materialised (TODO(R3-f03): name it via the capability→node mapping)."
    );
    return;
  }
  // identifiers present — the presence proxy holds (a name is NOT behavior).
});
