// ---------------------------------------------------------------------------
// store-crosstab.test.mjs — pins the cross-tab reconcile's `changed` verdict for
// operator-owned SCALAR edits (L3-02 store surface).
//
// `mergeCrossTabProject` union-merges the append-only row arrays, but its
// `changed` flag used to be derived from the row unions plus a four-field
// `crossTabDrifted` predicate (name/notes/status/currentPhase). A remote tab's
// toggle of an operator-owned scalar that touches NO row array (enforceDod /
// wildMode / kind) therefore returned `changed: false`; `applyCrossTabSnapshot`
// then skipped the commit and this tab kept its stale value until its next
// persist write clobbered the other tab's edit — a cross-tab lost update.
//
// Reproduced pre-fix: mergeCrossTabProject(local, remote) with only enforceDod
// differing returned { enforceDod: true, changed: false }. This pins changed
// true (adopt + warn) while an identical record stays `changed: false` (no
// commit, so the reconcile cannot ping-pong between tabs).
//
// Run: node --test scripts/store-crosstab.test.mjs
// ---------------------------------------------------------------------------
import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeCrossTabProject } from "../src/lib/store.ts";
import { emptyProject } from "../src/lib/engine.ts";

const BRIEF = "Build an inventory tracker for a small warehouse team with reorder alerts.";

test("cross-tab merge adopts an operator-owned scalar toggle (enforceDod) instead of dropping it", () => {
  const base = emptyProject({ name: "Toggle Pin", brief: BRIEF });
  const local = { ...base, enforceDod: false };
  const remote = { ...base, enforceDod: true };
  const merged = mergeCrossTabProject(local, remote);
  assert.equal(merged.project.enforceDod, true, "the other tab's toggle is adopted, not reverted");
  assert.equal(merged.changed, true, "a pure scalar change must report changed:true so the snapshot commits");
  assert.equal(merged.drifted, true, "the change raises the visible cross-tab notice");
});

test("cross-tab merge adopts a wildMode toggle and a kind change", () => {
  const base = emptyProject({ name: "Toggle Pin", brief: BRIEF });
  const wild = mergeCrossTabProject({ ...base, wildMode: false }, { ...base, wildMode: true });
  assert.equal(wild.project.wildMode, true);
  assert.equal(wild.changed, true);
  const kind = mergeCrossTabProject({ ...base, kind: "library" }, { ...base, kind: "tool" });
  assert.equal(kind.project.kind, "tool");
  assert.equal(kind.changed, true);
});

test("cross-tab merge of an identical record is a no-op (no commit, no ping-pong)", () => {
  const base = emptyProject({ name: "Toggle Pin", brief: BRIEF });
  const merged = mergeCrossTabProject(base, base);
  assert.equal(merged.changed, false, "an identical snapshot must not re-commit (the reconcile write loop would never settle)");
  assert.equal(merged.drifted, false);
});

test("cross-tab merge still adopts a rename and keeps a local-only appended row", () => {
  const base = emptyProject({ name: "Base", brief: BRIEF });
  const renamed = mergeCrossTabProject({ ...base, notes: "b" }, { ...base, name: "RenamedByA" });
  assert.equal(renamed.project.name, "RenamedByA");
  assert.equal(renamed.drifted, true);
  /** @type {import("../src/lib/types.ts").Artifact} */
  const localRow = { id: "local-only-1", phase: 0, kind: "docs", title: "B row", body: "b" };
  const merged = mergeCrossTabProject({ ...base, artifacts: [...base.artifacts, localRow] }, base);
  assert.ok(merged.project.artifacts.some((a) => a.id === localRow.id), "a local-only row survives");
});
