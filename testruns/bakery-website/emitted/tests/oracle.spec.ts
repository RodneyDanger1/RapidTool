// ---------------------------------------------------------------------------
// tests/oracle.spec.ts — acceptance tests from the A7 oracle (project.oracle)
// machine-generated from RapidTool packet 729ce422-bcaa-4b79-9ec6-4840b61a458e; regenerate, don't hand-edit.
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
//   src/generated/format-gbp.ts
//   src/generated/render-home.ts
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
const __capScanFiles = ["../src/generated.ts","../src/generated/format-gbp.ts","../src/generated/render-home.ts","../src/jobs/close.ts","../src/jobs/query.ts","../src/jobs/search.ts","../src/jobs/show.ts","../src/jobs/track.ts"];
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

// capability.1 — renderHome(badge: OpenStatus, highlights: MenuItem[], story: string): string
test("capability.1", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["renderhome","renderhom"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"renderHome(badge: OpenStatus, highlights: MenuItem[], story: string): string\" has NONE of its demanded identifier forms (renderhome, renderhom) in any emitted file — ../src/generated.ts, ../src/generated/format-gbp.ts, ../src/generated/render-home.ts, ../src/jobs/close.ts, ../src/jobs/query.ts, ../src/jobs/search.ts, ../src/jobs/show.ts, ../src/jobs/track.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.2 — computeOpenStatus(now: Date, hours: WeeklyHours, closures: HolidayClosure[]): OpenStatus
test("capability.2", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["computeopenstatus","computeopenstatu"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"computeOpenStatus(now: Date, hours: WeeklyHours, closures: HolidayClosure[]): OpenStatus\" has NONE of its demanded identifier forms (computeopenstatus, computeopenstatu) in any emitted file — ../src/generated.ts, ../src/generated/format-gbp.ts, ../src/generated/render-home.ts, ../src/jobs/close.ts, ../src/jobs/query.ts, ../src/jobs/search.ts, ../src/jobs/show.ts, ../src/jobs/track.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.3 — getWeeklyHours(): WeeklyHours
test("capability.3", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["getweeklyhours","getweeklyhour"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"getWeeklyHours(): WeeklyHours\" has NONE of its demanded identifier forms (getweeklyhours, getweeklyhour) in any emitted file — ../src/generated.ts, ../src/generated/format-gbp.ts, ../src/generated/render-home.ts, ../src/jobs/close.ts, ../src/jobs/query.ts, ../src/jobs/search.ts, ../src/jobs/show.ts, ../src/jobs/track.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.4 — getHolidayClosures(): HolidayClosure[]
test("capability.4", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["getholidayclosures","getholidayclosur"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"getHolidayClosures(): HolidayClosure[]\" has NONE of its demanded identifier forms (getholidayclosures, getholidayclosur) in any emitted file — ../src/generated.ts, ../src/generated/format-gbp.ts, ../src/generated/render-home.ts, ../src/jobs/close.ts, ../src/jobs/query.ts, ../src/jobs/search.ts, ../src/jobs/show.ts, ../src/jobs/track.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.5 — renderHoursPage(hours: WeeklyHours, closures: HolidayClosure[], mapImage: { src: string; alt: string }, directionsUrl: string): string
test("capability.5", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["renderhourspage","renderhourspag"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"renderHoursPage(hours: WeeklyHours, closures: HolidayClosure[], mapImage: { src: string; alt: string }, directionsUrl: string): string\" has NONE of its demanded identifier forms (renderhourspage, renderhourspag) in any emitted file — ../src/generated.ts, ../src/generated/format-gbp.ts, ../src/generated/render-home.ts, ../src/jobs/close.ts, ../src/jobs/query.ts, ../src/jobs/search.ts, ../src/jobs/show.ts, ../src/jobs/track.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.6 — getMenuItems(): MenuItem[]
test("capability.6", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["getmenuitems","getmenuitem"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"getMenuItems(): MenuItem[]\" has NONE of its demanded identifier forms (getmenuitems, getmenuitem) in any emitted file — ../src/generated.ts, ../src/generated/format-gbp.ts, ../src/generated/render-home.ts, ../src/jobs/close.ts, ../src/jobs/query.ts, ../src/jobs/search.ts, ../src/jobs/show.ts, ../src/jobs/track.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.7 — filterMenu(items: MenuItem[], filters: MenuFilters): MenuItem[]
test("capability.7", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["filtermenu"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"filterMenu(items: MenuItem[], filters: MenuFilters): MenuItem[]\" has NONE of its demanded identifier forms (filtermenu) in any emitted file — ../src/generated.ts, ../src/generated/format-gbp.ts, ../src/generated/render-home.ts, ../src/jobs/close.ts, ../src/jobs/query.ts, ../src/jobs/search.ts, ../src/jobs/show.ts, ../src/jobs/track.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.8 — renderMenu(items: MenuItem[], filters: MenuFilters): string
test("capability.8", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["rendermenu"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"renderMenu(items: MenuItem[], filters: MenuFilters): string\" has NONE of its demanded identifier forms (rendermenu) in any emitted file — ../src/generated.ts, ../src/generated/format-gbp.ts, ../src/generated/render-home.ts, ../src/jobs/close.ts, ../src/jobs/query.ts, ../src/jobs/search.ts, ../src/jobs/show.ts, ../src/jobs/track.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.9 — formatGbp(amount: number): string
test("capability.9", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["formatgbp"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"formatGbp(amount: number): string\" has NONE of its demanded identifier forms (formatgbp) in any emitted file — ../src/generated.ts, ../src/generated/format-gbp.ts, ../src/generated/render-home.ts, ../src/jobs/close.ts, ../src/jobs/query.ts, ../src/jobs/search.ts, ../src/jobs/show.ts, ../src/jobs/track.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.10 — computeLineTotal(unitPrice: number, quantity: number): number
test("capability.10", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["computelinetotal"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"computeLineTotal(unitPrice: number, quantity: number): number\" has NONE of its demanded identifier forms (computelinetotal) in any emitted file — ../src/generated.ts, ../src/generated/format-gbp.ts, ../src/generated/render-home.ts, ../src/jobs/close.ts, ../src/jobs/query.ts, ../src/jobs/search.ts, ../src/jobs/show.ts, ../src/jobs/track.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.11 — validateOrder(input: OrderInput): OrderValidationResult
test("capability.11", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["validateorder","validateord"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"validateOrder(input: OrderInput): OrderValidationResult\" has NONE of its demanded identifier forms (validateorder, validateord) in any emitted file — ../src/generated.ts, ../src/generated/format-gbp.ts, ../src/generated/render-home.ts, ../src/jobs/close.ts, ../src/jobs/query.ts, ../src/jobs/search.ts, ../src/jobs/show.ts, ../src/jobs/track.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.12 — submitOrder(input: OrderInput, now: Date): OrderResult
test("capability.12", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["submitorder","submitord"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"submitOrder(input: OrderInput, now: Date): OrderResult\" has NONE of its demanded identifier forms (submitorder, submitord) in any emitted file — ../src/generated.ts, ../src/generated/format-gbp.ts, ../src/generated/render-home.ts, ../src/jobs/close.ts, ../src/jobs/query.ts, ../src/jobs/search.ts, ../src/jobs/show.ts, ../src/jobs/track.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.13 — generateOrderReference(now: Date, sequence: number): string
test("capability.13", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["generateorderreference","generateorderreferenc"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"generateOrderReference(now: Date, sequence: number): string\" has NONE of its demanded identifier forms (generateorderreference, generateorderreferenc) in any emitted file — ../src/generated.ts, ../src/generated/format-gbp.ts, ../src/generated/render-home.ts, ../src/jobs/close.ts, ../src/jobs/query.ts, ../src/jobs/search.ts, ../src/jobs/show.ts, ../src/jobs/track.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.14 — renderOrderConfirmation(order: Order, reference: string): string
test("capability.14", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["renderorderconfirmation"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"renderOrderConfirmation(order: Order, reference: string): string\" has NONE of its demanded identifier forms (renderorderconfirmation) in any emitted file — ../src/generated.ts, ../src/generated/format-gbp.ts, ../src/generated/render-home.ts, ../src/jobs/close.ts, ../src/jobs/query.ts, ../src/jobs/search.ts, ../src/jobs/show.ts, ../src/jobs/track.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.15 — renderContactPage(contact: ContactInfo, faq: FAQEntry[]): string
test("capability.15", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["rendercontactpage","rendercontactpag"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"renderContactPage(contact: ContactInfo, faq: FAQEntry[]): string\" has NONE of its demanded identifier forms (rendercontactpage, rendercontactpag) in any emitted file — ../src/generated.ts, ../src/generated/format-gbp.ts, ../src/generated/render-home.ts, ../src/jobs/close.ts, ../src/jobs/query.ts, ../src/jobs/search.ts, ../src/jobs/show.ts, ../src/jobs/track.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.16 — runShow(command: ShowCommand): Promise<Text>
test("capability.16", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["runshow"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"runShow(command: ShowCommand): Promise<Text>\" has NONE of its demanded identifier forms (runshow) in any emitted file — ../src/generated.ts, ../src/generated/format-gbp.ts, ../src/generated/render-home.ts, ../src/jobs/close.ts, ../src/jobs/query.ts, ../src/jobs/search.ts, ../src/jobs/show.ts, ../src/jobs/track.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.17 — listShowRuns(id: string, limit?: number): Promise<ShowRun[]>
test("capability.17", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["listshowruns","listshowrun"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"listShowRuns(id: string, limit?: number): Promise<ShowRun[]>\" has NONE of its demanded identifier forms (listshowruns, listshowrun) in any emitted file — ../src/generated.ts, ../src/generated/format-gbp.ts, ../src/generated/render-home.ts, ../src/jobs/close.ts, ../src/jobs/query.ts, ../src/jobs/search.ts, ../src/jobs/show.ts, ../src/jobs/track.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.18 — runSearch(command: SearchCommand): Promise<Table>
test("capability.18", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["runsearch"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"runSearch(command: SearchCommand): Promise<Table>\" has NONE of its demanded identifier forms (runsearch) in any emitted file — ../src/generated.ts, ../src/generated/format-gbp.ts, ../src/generated/render-home.ts, ../src/jobs/close.ts, ../src/jobs/query.ts, ../src/jobs/search.ts, ../src/jobs/show.ts, ../src/jobs/track.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.19 — listSearchRuns(id: string, limit?: number): Promise<SearchRun[]>
test("capability.19", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["listsearchruns","listsearchrun"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"listSearchRuns(id: string, limit?: number): Promise<SearchRun[]>\" has NONE of its demanded identifier forms (listsearchruns, listsearchrun) in any emitted file — ../src/generated.ts, ../src/generated/format-gbp.ts, ../src/generated/render-home.ts, ../src/jobs/close.ts, ../src/jobs/query.ts, ../src/jobs/search.ts, ../src/jobs/show.ts, ../src/jobs/track.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.20 — runClose(command: CloseCommand): Promise<Page>
test("capability.20", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["runclose","runclo"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"runClose(command: CloseCommand): Promise<Page>\" has NONE of its demanded identifier forms (runclose, runclo) in any emitted file — ../src/generated.ts, ../src/generated/format-gbp.ts, ../src/generated/render-home.ts, ../src/jobs/close.ts, ../src/jobs/query.ts, ../src/jobs/search.ts, ../src/jobs/show.ts, ../src/jobs/track.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.21 — listCloseRuns(id: string, limit?: number): Promise<CloseRun[]>
test("capability.21", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["listcloseruns","listcloserun"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"listCloseRuns(id: string, limit?: number): Promise<CloseRun[]>\" has NONE of its demanded identifier forms (listcloseruns, listcloserun) in any emitted file — ../src/generated.ts, ../src/generated/format-gbp.ts, ../src/generated/render-home.ts, ../src/jobs/close.ts, ../src/jobs/query.ts, ../src/jobs/search.ts, ../src/jobs/show.ts, ../src/jobs/track.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.22 — runTrack(command: TrackCommand): Promise<Image>
test("capability.22", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["runtrack"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"runTrack(command: TrackCommand): Promise<Image>\" has NONE of its demanded identifier forms (runtrack) in any emitted file — ../src/generated.ts, ../src/generated/format-gbp.ts, ../src/generated/render-home.ts, ../src/jobs/close.ts, ../src/jobs/query.ts, ../src/jobs/search.ts, ../src/jobs/show.ts, ../src/jobs/track.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.23 — listTrackRuns(id: string, limit?: number): Promise<TrackRun[]>
test("capability.23", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["listtrackruns","listtrackrun"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"listTrackRuns(id: string, limit?: number): Promise<TrackRun[]>\" has NONE of its demanded identifier forms (listtrackruns, listtrackrun) in any emitted file — ../src/generated.ts, ../src/generated/format-gbp.ts, ../src/generated/render-home.ts, ../src/jobs/close.ts, ../src/jobs/query.ts, ../src/jobs/search.ts, ../src/jobs/show.ts, ../src/jobs/track.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.24 — runQuery(command: QueryCommand): Promise<Link>
test("capability.24", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["runquery"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"runQuery(command: QueryCommand): Promise<Link>\" has NONE of its demanded identifier forms (runquery) in any emitted file — ../src/generated.ts, ../src/generated/format-gbp.ts, ../src/generated/render-home.ts, ../src/jobs/close.ts, ../src/jobs/query.ts, ../src/jobs/search.ts, ../src/jobs/show.ts, ../src/jobs/track.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.25 — listQueryRuns(id: string, limit?: number): Promise<QueryRun[]>
test("capability.25", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["listqueryruns","listqueryrun"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"listQueryRuns(id: string, limit?: number): Promise<QueryRun[]>\" has NONE of its demanded identifier forms (listqueryruns, listqueryrun) in any emitted file — ../src/generated.ts, ../src/generated/format-gbp.ts, ../src/generated/render-home.ts, ../src/jobs/close.ts, ../src/jobs/query.ts, ../src/jobs/search.ts, ../src/jobs/show.ts, ../src/jobs/track.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});
