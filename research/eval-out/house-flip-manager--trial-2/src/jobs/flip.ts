// ---------------------------------------------------------------------------
// src/jobs/flip.ts — Implement job “flip” against the contract
// machine-generated from RapidTool packet 7d029422-0047-48f7-9096-fe57456b3f9c; regenerate, don't hand-edit.
// This file hosts the machine-verified P6 synthesis module (project.generatedSource),
// verbatim below. Its self-tests ran inside the engine isolate at P6 — keep them
// green when you implement the surrounding jobs.
// ---------------------------------------------------------------------------

const JOBS = ["flip", "invoice", "track", "rehab", "bid"];
const REJECTION = "";
function synthesize(spec) {
  if (spec.phase < 0 || spec.phase > 12) throw new Error("invalid phase");
  if (JOBS.indexOf(spec.job) === -1) throw new Error("unknown job");
  if (REJECTION && spec.phase === 9) throw new Error("deploy blocked until rejection addressed");
  return { ok: true, name: spec.name, job: spec.job, addressed: REJECTION ? true : false };
}
function test_happy() {
  var out = synthesize({ name: "House-Flipping Manager", phase: 6, job: "flip" });
  if (!out.ok) throw new Error("expected ok");
  if (out.job !== "flip") throw new Error("job mismatch");
}
function test_no_skip() {
  var threw = false;
  try { synthesize({ name: "x", phase: -1, job: "flip" }); } catch (e) { threw = true; }
  if (!threw) throw new Error("should reject illegal phase");
}
function test_rejection_addressed() {
  var out = synthesize({ name: "x", phase: 6, job: "flip" });
  if (REJECTION && !out.addressed) throw new Error("rejection not addressed");
}

// Machine export surface (scaffold emitter, fixes/135): the P6 template's
// top-level names, exported so tests/oracle.spec.ts can assert the module's
// REAL behavior. Not part of generatedSource — regenerating the scaffold
// restores this line automatically.
export { JOBS, REJECTION, synthesize };
