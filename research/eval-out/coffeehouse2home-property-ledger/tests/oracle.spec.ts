// ---------------------------------------------------------------------------
// tests/oracle.spec.ts — acceptance tests from the A7 oracle (project.oracle)
// machine-generated from RapidTool packet 6007f9af-f6d5-4b2e-9eaa-ede6f800cb6e; regenerate, don't hand-edit.
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
import * as treeModule from "../src/generated/get-property.ts";

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
//   src/generated/get-property.ts  (entry)

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

test.skip("orc-1 — NOT IMPLEMENTED", () => {
  // A7 row "orc-1" "job.track.happy" — Authorized operator submits “track” with a valid buyer => 200 + persisted entity + checkpoint written
  // NOT IMPLEMENTED: no emitted module surface targets this row yet (106
  // T-08 / F-05). The pre-fix emission asserted "orc-1".length > 0 —
  // which cannot fail, so it was not evidence; this row is skipped instead.
  // Replace the skip with the row's real acceptance assertion when the
  // seam (HTTP endpoint or P6 host) lands.
  assert.fail("orc-1 is NOT IMPLEMENTED — replace this skip with the row's real acceptance assertion");
});

test.skip("orc-2 — NOT IMPLEMENTED", () => {
  // A7 row "orc-2" "job.record.happy" — Authorized operator submits “record” with a valid buyer => 200 + persisted entity + checkpoint written
  // NOT IMPLEMENTED: no emitted module surface targets this row yet (106
  // T-08 / F-05). The pre-fix emission asserted "orc-2".length > 0 —
  // which cannot fail, so it was not evidence; this row is skipped instead.
  // Replace the skip with the row's real acceptance assertion when the
  // seam (HTTP endpoint or P6 host) lands.
  assert.fail("orc-2 is NOT IMPLEMENTED — replace this skip with the row's real acceptance assertion");
});

test.skip("orc-3 — NOT IMPLEMENTED", () => {
  // A7 row "orc-3" "job.flip.happy" — Authorized operator submits “flip” with a valid buyer => 200 + persisted entity + checkpoint written
  // NOT IMPLEMENTED: no emitted module surface targets this row yet (106
  // T-08 / F-05). The pre-fix emission asserted "orc-3".length > 0 —
  // which cannot fail, so it was not evidence; this row is skipped instead.
  // Replace the skip with the row's real acceptance assertion when the
  // seam (HTTP endpoint or P6 host) lands.
  assert.fail("orc-3 is NOT IMPLEMENTED — replace this skip with the row's real acceptance assertion");
});

test.skip("orc-4 — NOT IMPLEMENTED", () => {
  // A7 row "orc-4" "job.show.happy" — Authorized operator submits “show” with a valid buyer => 200 + persisted entity + checkpoint written
  // NOT IMPLEMENTED: no emitted module surface targets this row yet (106
  // T-08 / F-05). The pre-fix emission asserted "orc-4".length > 0 —
  // which cannot fail, so it was not evidence; this row is skipped instead.
  // Replace the skip with the row's real acceptance assertion when the
  // seam (HTTP endpoint or P6 host) lands.
  assert.fail("orc-4 is NOT IMPLEMENTED — replace this skip with the row's real acceptance assertion");
});

test.skip("orc-5 — NOT IMPLEMENTED", () => {
  // A7 row "orc-5" "job.lease.happy" — Authorized operator submits “lease” with a valid buyer => 200 + persisted entity + checkpoint written
  // NOT IMPLEMENTED: no emitted module surface targets this row yet (106
  // T-08 / F-05). The pre-fix emission asserted "orc-5".length > 0 —
  // which cannot fail, so it was not evidence; this row is skipped instead.
  // Replace the skip with the row's real acceptance assertion when the
  // seam (HTTP endpoint or P6 host) lands.
  assert.fail("orc-5 is NOT IMPLEMENTED — replace this skip with the row's real acceptance assertion");
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
const __capScanFiles = ["../src/generated/get-property.ts"];
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

// capability.1 — getProperty(propertyId: string): Promise<PropertyLedgerRecord>
test("capability.1", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["getproperty"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"getProperty(propertyId: string): Promise<PropertyLedgerRecord>\" has NONE of its demanded identifier forms (getproperty) in any emitted file — ../src/generated/get-property.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.2 — updateProperty(propertyId: string, changes: Partial<PropertyLedgerRecord>): Promise<PropertyLedgerRecord>
test("capability.2", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["updateproperty"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"updateProperty(propertyId: string, changes: Partial<PropertyLedgerRecord>): Promise<PropertyLedgerRecord>\" has NONE of its demanded identifier forms (updateproperty) in any emitted file — ../src/generated/get-property.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.3 — getPropertyHistory(propertyId: string): Promise<LedgerHistoryEntry[]>
test("capability.3", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["getpropertyhistory"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"getPropertyHistory(propertyId: string): Promise<LedgerHistoryEntry[]>\" has NONE of its demanded identifier forms (getpropertyhistory) in any emitted file — ../src/generated/get-property.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.4 — createContact(contact: ContactInput): Promise<Contact>
test("capability.4", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["createcontact"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"createContact(contact: ContactInput): Promise<Contact>\" has NONE of its demanded identifier forms (createcontact) in any emitted file — ../src/generated/get-property.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.5 — createBuyerLead(lead: BuyerLeadInput): Promise<BuyerLead>
test("capability.5", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["createbuyerlead"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"createBuyerLead(lead: BuyerLeadInput): Promise<BuyerLead>\" has NONE of its demanded identifier forms (createbuyerlead) in any emitted file — ../src/generated/get-property.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.6 — createSellerLead(lead: SellerLeadInput): Promise<SellerLead>
test("capability.6", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["createsellerlead"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"createSellerLead(lead: SellerLeadInput): Promise<SellerLead>\" has NONE of its demanded identifier forms (createsellerlead) in any emitted file — ../src/generated/get-property.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.7 — createDeal(contactId: string, propertyId: string): Promise<Deal>
test("capability.7", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["createdeal"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"createDeal(contactId: string, propertyId: string): Promise<Deal>\" has NONE of its demanded identifier forms (createdeal) in any emitted file — ../src/generated/get-property.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.8 — moveDealStage(dealId: string, stage: DealStage): Promise<Deal>
test("capability.8", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["movedealstage","movedealstag"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"moveDealStage(dealId: string, stage: DealStage): Promise<Deal>\" has NONE of its demanded identifier forms (movedealstage, movedealstag) in any emitted file — ../src/generated/get-property.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.9 — getDealPipeline(): Promise<DealPipelineView>
test("capability.9", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["getdealpipeline","getdealpipelin"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"getDealPipeline(): Promise<DealPipelineView>\" has NONE of its demanded identifier forms (getdealpipeline, getdealpipelin) in any emitted file — ../src/generated/get-property.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.10 — publishShowingSlots(propertyId: string, slots: ShowingSlotInput[]): Promise<ShowingSlot[]>
test("capability.10", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["publishshowingslots","publishshowingslot"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"publishShowingSlots(propertyId: string, slots: ShowingSlotInput[]): Promise<ShowingSlot[]>\" has NONE of its demanded identifier forms (publishshowingslots, publishshowingslot) in any emitted file — ../src/generated/get-property.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.11 — bookShowing(slotId: string, buyer: BuyerInput): Promise<ShowingBooking>
test("capability.11", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["bookshowing","bookshow"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"bookShowing(slotId: string, buyer: BuyerInput): Promise<ShowingBooking>\" has NONE of its demanded identifier forms (bookshowing, bookshow) in any emitted file — ../src/generated/get-property.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.12 — sendShowingConfirmation(bookingId: string): Promise<ConfirmationResult>
test("capability.12", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["sendshowingconfirmation"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"sendShowingConfirmation(bookingId: string): Promise<ConfirmationResult>\" has NONE of its demanded identifier forms (sendshowingconfirmation) in any emitted file — ../src/generated/get-property.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.13 — scheduleShowingReminder(bookingId: string, remindAt: Date): Promise<Reminder>
test("capability.13", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["scheduleshowingreminder","scheduleshowingremind"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"scheduleShowingReminder(bookingId: string, remindAt: Date): Promise<Reminder>\" has NONE of its demanded identifier forms (scheduleshowingreminder, scheduleshowingremind) in any emitted file — ../src/generated/get-property.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.14 — syncShowingToCalendar(bookingId: string): Promise<CalendarSyncStubResult>
test("capability.14", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["syncshowingtocalendar"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"syncShowingToCalendar(bookingId: string): Promise<CalendarSyncStubResult>\" has NONE of its demanded identifier forms (syncshowingtocalendar) in any emitted file — ../src/generated/get-property.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.15 — getShowingHistory(propertyId: string): Promise<ShowingRecord[]>
test("capability.15", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["getshowinghistory"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"getShowingHistory(propertyId: string): Promise<ShowingRecord[]>\" has NONE of its demanded identifier forms (getshowinghistory) in any emitted file — ../src/generated/get-property.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.16 — submitShowingFeedback(bookingId: string, feedback: string): Promise<ShowingFeedback>
test("capability.16", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["submitshowingfeedback"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"submitShowingFeedback(bookingId: string, feedback: string): Promise<ShowingFeedback>\" has NONE of its demanded identifier forms (submitshowingfeedback) in any emitted file — ../src/generated/get-property.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.17 — recordAcquisition(propertyId: string, acquisition: AcquisitionInput): Promise<Acquisition>
test("capability.17", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["recordacquisition"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"recordAcquisition(propertyId: string, acquisition: AcquisitionInput): Promise<Acquisition>\" has NONE of its demanded identifier forms (recordacquisition) in any emitted file — ../src/generated/get-property.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.18 — createRenovationBudget(propertyId: string): Promise<RenovationBudget>
test("capability.18", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["createrenovationbudget"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"createRenovationBudget(propertyId: string): Promise<RenovationBudget>\" has NONE of its demanded identifier forms (createrenovationbudget) in any emitted file — ../src/generated/get-property.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.19 — addBudgetLineItem(budgetId: string, item: LineItemInput): Promise<RenovationBudget>
test("capability.19", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["addbudgetlineitem"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"addBudgetLineItem(budgetId: string, item: LineItemInput): Promise<RenovationBudget>\" has NONE of its demanded identifier forms (addbudgetlineitem) in any emitted file — ../src/generated/get-property.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.20 — submitContractorBid(propertyId: string, bid: ContractorBidInput): Promise<ContractorBid>
test("capability.20", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["submitcontractorbid"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"submitContractorBid(propertyId: string, bid: ContractorBidInput): Promise<ContractorBid>\" has NONE of its demanded identifier forms (submitcontractorbid) in any emitted file — ../src/generated/get-property.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.21 — advanceFlipPhase(propertyId: string, phase: FlipPhase): Promise<FlipProject>
test("capability.21", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["advanceflipphase","advanceflippha"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"advanceFlipPhase(propertyId: string, phase: FlipPhase): Promise<FlipProject>\" has NONE of its demanded identifier forms (advanceflipphase, advanceflippha) in any emitted file — ../src/generated/get-property.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.22 — getJobCost(propertyId: string): Promise<JobCost>
test("capability.22", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["getjobcost"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"getJobCost(propertyId: string): Promise<JobCost>\" has NONE of its demanded identifier forms (getjobcost) in any emitted file — ../src/generated/get-property.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.23 — createLease(propertyId: string, lease: LeaseInput): Promise<Lease>
test("capability.23", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["createlease","createlea"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"createLease(propertyId: string, lease: LeaseInput): Promise<Lease>\" has NONE of its demanded identifier forms (createlease, createlea) in any emitted file — ../src/generated/get-property.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.24 — addTenant(leaseId: string, tenant: TenantInput): Promise<Tenant>
test("capability.24", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["addtenant"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"addTenant(leaseId: string, tenant: TenantInput): Promise<Tenant>\" has NONE of its demanded identifier forms (addtenant) in any emitted file — ../src/generated/get-property.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.25 — postRentPayment(leaseId: string, payment: PaymentInput): Promise<PaymentRecord>
test("capability.25", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["postrentpayment"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"postRentPayment(leaseId: string, payment: PaymentInput): Promise<PaymentRecord>\" has NONE of its demanded identifier forms (postrentpayment) in any emitted file — ../src/generated/get-property.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.26 — getRentRoll(propertyId: string): Promise<RentRollEntry[]>
test("capability.26", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["getrentroll","getrentrol"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"getRentRoll(propertyId: string): Promise<RentRollEntry[]>\" has NONE of its demanded identifier forms (getrentroll, getrentrol) in any emitted file — ../src/generated/get-property.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.27 — createMaintenanceRequest(propertyId: string, request: MaintenanceRequestInput): Promise<MaintenanceRequest>
test("capability.27", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["createmaintenancerequest"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"createMaintenanceRequest(propertyId: string, request: MaintenanceRequestInput): Promise<MaintenanceRequest>\" has NONE of its demanded identifier forms (createmaintenancerequest) in any emitted file — ../src/generated/get-property.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.28 — getVacancyStatus(propertyId: string): Promise<VacancyStatus>
test("capability.28", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["getvacancystatus","getvacancystatu"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"getVacancyStatus(propertyId: string): Promise<VacancyStatus>\" has NONE of its demanded identifier forms (getvacancystatus, getvacancystatu) in any emitted file — ../src/generated/get-property.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.29 — generateLeaseRenewalReminder(leaseId: string): Promise<RenewalReminder>
test("capability.29", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["generateleaserenewalreminder","generateleaserenewalremind"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"generateLeaseRenewalReminder(leaseId: string): Promise<RenewalReminder>\" has NONE of its demanded identifier forms (generateleaserenewalreminder, generateleaserenewalremind) in any emitted file — ../src/generated/get-property.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.30 — raiseWorkOrder(source: WorkOrderSource, sourceId: string): Promise<WorkOrder>
test("capability.30", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["raiseworkorder","raiseworkord"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"raiseWorkOrder(source: WorkOrderSource, sourceId: string): Promise<WorkOrder>\" has NONE of its demanded identifier forms (raiseworkorder, raiseworkord) in any emitted file — ../src/generated/get-property.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.31 — buildCrewTaskList(workOrderId: string): Promise<CrewTask[]>
test("capability.31", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["buildcrewtasklist"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"buildCrewTaskList(workOrderId: string): Promise<CrewTask[]>\" has NONE of its demanded identifier forms (buildcrewtasklist) in any emitted file — ../src/generated/get-property.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.32 — logCrewTimeSheet(entry: TimeSheetEntryInput): Promise<TimeSheetEntry>
test("capability.32", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["logcrewtimesheet"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"logCrewTimeSheet(entry: TimeSheetEntryInput): Promise<TimeSheetEntry>\" has NONE of its demanded identifier forms (logcrewtimesheet) in any emitted file — ../src/generated/get-property.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.33 — computeWeeklyPayroll(weekStart: Date): Promise<PayrollSummary>
test("capability.33", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["computeweeklypayroll","computeweeklypayrol"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"computeWeeklyPayroll(weekStart: Date): Promise<PayrollSummary>\" has NONE of its demanded identifier forms (computeweeklypayroll, computeweeklypayrol) in any emitted file — ../src/generated/get-property.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.34 — addSupplyItem(propertyId: string, item: SupplyItemInput): Promise<SupplyItem>
test("capability.34", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["addsupplyitem"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"addSupplyItem(propertyId: string, item: SupplyItemInput): Promise<SupplyItem>\" has NONE of its demanded identifier forms (addsupplyitem) in any emitted file — ../src/generated/get-property.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.35 — recordPurchase(supplyItemId: string, purchase: PurchaseInput): Promise<PurchaseRecord>
test("capability.35", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["recordpurchase","recordpurcha"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"recordPurchase(supplyItemId: string, purchase: PurchaseInput): Promise<PurchaseRecord>\" has NONE of its demanded identifier forms (recordpurchase, recordpurcha) in any emitted file — ../src/generated/get-property.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});

// capability.36 — checkReorderFlag(supplyItemId: string): Promise<ReorderFlagResult>
test("capability.36", () => {
  // Demanded identifier forms (content tokens + canonical stems;
  // stopword-free): presence of ANY of them in the scanned files counts.
  const forms = ["checkreorderflag"];
  const carried = __capScanFiles.filter((f) => __capCarries(f, forms));
  assert.ok(
    carried.length > 0,
    "capability presence proxy FAILED: capability \"checkReorderFlag(supplyItemId: string): Promise<ReorderFlagResult>\" has NONE of its demanded identifier forms (checkreorderflag) in any emitted file — ../src/generated/get-property.ts. Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."
  );
});
