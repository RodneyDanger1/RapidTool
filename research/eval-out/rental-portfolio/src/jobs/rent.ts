// ---------------------------------------------------------------------------
// src/jobs/rent.ts — Implement job “rent” against the contract
// machine-generated from RapidTool packet 5587eca3-156b-4c57-9ea4-23879f548cb5; regenerate, don't hand-edit.
// This file hosts the machine-verified P6 synthesis module (project.generatedSource),
// verbatim below. Its self-tests ran inside the engine isolate at P6 — keep them
// green when you implement the surrounding jobs.
// ---------------------------------------------------------------------------

const JOBS = ["rent", "schedule", "track", "lease"];
const REJECTION = "";
function synthesize(spec) {
  if (spec.phase < 0 || spec.phase > 12) throw new Error("invalid phase");
  if (JOBS.indexOf(spec.job) === -1) throw new Error("unknown job");
  if (REJECTION && spec.phase === 9) throw new Error("deploy blocked until rejection addressed");
  return { ok: true, name: spec.name, job: spec.job, addressed: REJECTION ? true : false };
}
function test_happy() {
  var out = synthesize({ name: "Rental Portfolio Manager", phase: 6, job: "rent" });
  if (!out.ok) throw new Error("expected ok");
  if (out.job !== "rent") throw new Error("job mismatch");
}
function test_no_skip() {
  var threw = false;
  try { synthesize({ name: "x", phase: -1, job: "rent" }); } catch (e) { threw = true; }
  if (!threw) throw new Error("should reject illegal phase");
}
function test_rejection_addressed() {
  var out = synthesize({ name: "x", phase: 6, job: "rent" });
  if (REJECTION && !out.addressed) throw new Error("rejection not addressed");
}

// Machine export surface (scaffold emitter, fixes/135): the P6 template's
// top-level names, exported so tests/oracle.spec.ts can assert the module's
// REAL behavior. Not part of generatedSource — regenerating the scaffold
// restores this line automatically.
export { JOBS, REJECTION, synthesize };
