import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { NEXT_ACTION_KINDS, createProject, nextAction, summary } from "../src/lib/headless.ts";
import { projectRoot } from "./with-app-env.mjs";

/**
 * W16 L2 / TASK-01 — arm-parity doc-contract test for `nextAction` on the
 * summary envelope (`src/lib/headless.ts`).
 *
 * THE PIN: the envelope's `nextAction.kind` vocabulary must be EXACTLY the
 * console's pinned 7-arm vocabulary — `NEXT_ACTION_BUTTON` in
 * `src/components/console.tsx` (keys of `UiNextAction["kind"]`) — so the wire
 * contract and the UI can never drift.
 *
 * The console half is read as SOURCE TEXT (`node:fs`), never imported: this
 * test runs in bare Node under the scripts leg, and the source bytes are the
 * same artifact a reviewer diffs. Matching is CONTENT-anchored (symbol +
 * regex), not line-number-anchored — console.tsx is edited by other lanes in
 * this wave and line numbers drift.
 *
 * Also pins the BEHAVIOURAL half the brief demands: all seven arms are
 * reachable and each is its own distinguishable case (e.g. `fix-gate` must
 * not collapse into the `run` arms), the envelope shape is exactly
 * `{kind, cmd, phase, why}`, and every `cmd` names a real CLI verb.
 */
const ROOT = projectRoot();
const CONSOLE_TSX = readFileSync(join(ROOT, "src", "components", "console.tsx"), "utf8");

/** The five real CLI verbs the console's doc-comment names for its branches
 *  ("every branch names a real CLI verb (gate / approve / retry / emit /
 *  status)"). Pinned as the allowed `cmd` set. */
const CLI_VERBS = ["gate", "approve", "retry", "emit", "status"];

/** Keys of the NEXT_ACTION_BUTTON record — the pinned arm vocabulary. */
function consoleButtonArmKeys() {
  const m = CONSOLE_TSX.match(/const NEXT_ACTION_BUTTON[^=]*=\s*\{([\s\S]*?)\n\};/);
  assert.ok(m, "NEXT_ACTION_BUTTON record block not found in console.tsx");
  const body = m[1].replace(/\/\/[^\n]*/g, ""); // strip line comments before key scan
  return [...body.matchAll(/(?:^|\n)\s*"?([a-z][a-z-]*)"?\s*:/g)].map((x) => x[1]);
}

/** The UiNextAction kind union's arms, in declared order. */
function consoleKindUnion() {
  const m = CONSOLE_TSX.match(/type UiNextAction = \{\s*kind:\s*([^;]+);/);
  assert.ok(m, "UiNextAction kind union not found in console.tsx");
  return [...m[1].matchAll(/"([a-z-]+)"/g)].map((x) => x[1]);
}

const BRIEF =
  "Reduce invoice reconciliation time for a 3-person accounting team by building a small internal web tool.";

function base() {
  return createProject({ brief: BRIEF, name: "LANE2-TASK01 fixture" });
}

/** base() with phase 0 patched (immutably). */
function withPhase0(patch) {
  const p = base();
  return { ...p, phases: p.phases.map((r) => (r.id === 0 ? { ...r, ...patch } : r)) };
}

const HITL = { phase: 0, title: "P0 review", prompt: "Approve P0?", stakes: "gate", requestedAt: 1 };
const RED_GATE = { passed: false, unmet: ["p0-brief-fit"], evidenceHash: "deadbeef", checkedAt: 1 };

/** One fixture per arm; `run` appears twice (rejected sub-arm + default arm). */
const ARM_FIXTURES = [
  ["unknown", () => ({ ...base(), phases: [] })],
  ["running", () => withPhase0({ status: "running" })],
  ["approve", () => ({ ...base(), hitl: HITL })],
  ["retry", () => ({ ...base(), status: "blocked" })],
  ["done", () => ({ ...base(), status: "complete" })],
  ["fix-gate", () => withPhase0({ gate: RED_GATE })],
  ["run", () => withPhase0({ status: "rejected" })],
  ["run", () => base()],
];

test("TASK-01 arm-parity: wire vocabulary === console NEXT_ACTION_BUTTON arms (both directions)", () => {
  const buttonKeys = consoleButtonArmKeys();
  const unionKinds = consoleKindUnion();

  // The console's own two sources agree with each other, 7 arms, no dupes.
  assert.equal(buttonKeys.length, 7, `NEXT_ACTION_BUTTON must pin exactly 7 arms (got ${buttonKeys.length})`);
  assert.equal(new Set(buttonKeys).size, 7, "NEXT_ACTION_BUTTON arms must be unique");
  assert.deepEqual([...unionKinds].sort(), [...buttonKeys].sort(), "console kind union === NEXT_ACTION_BUTTON keys");

  // The wire vocabulary is set-equal to the console arms, both directions.
  assert.equal(NEXT_ACTION_KINDS.length, 7);
  assert.deepEqual([...NEXT_ACTION_KINDS].sort(), [...buttonKeys].sort(), "NEXT_ACTION_KINDS === console arms");

  // ...and it mirrors the union's declared order (the claim in headless.ts).
  assert.deepEqual([...NEXT_ACTION_KINDS], unionKinds, "NEXT_ACTION_KINDS order === console union order");
});

test("TASK-01 arms: all seven arms reachable, distinguishable, real-CLI-verb cmds", () => {
  const seen = new Set();
  for (const [expected, make] of ARM_FIXTURES) {
    const project = make();
    const action = nextAction(project);
    assert.equal(action.kind, expected, `fixture for '${expected}' produced '${action.kind}'`);
    assert.ok(NEXT_ACTION_KINDS.includes(action.kind) && action.kind !== undefined);
    assert.deepEqual(Object.keys(action).sort(), ["cmd", "kind", "phase", "why"], "envelope shape");
    assert.ok(CLI_VERBS.includes(action.cmd), `cmd '${action.cmd}' must be a real CLI verb`);
    assert.equal(typeof action.why, "string");
    assert.ok(action.why.length > 0, "why is a non-empty sentence");
    seen.add(action.kind);
  }
  assert.deepEqual([...seen].sort(), [...NEXT_ACTION_KINDS].sort(), "all 7 arms reachable (none collapsed)");
});

test("TASK-01 branch order: the most urgent fact wins (console branch-order parity)", () => {
  // running outranks a parked HITL gate
  assert.equal(nextAction({ ...withPhase0({ status: "running" }), hitl: HITL }).kind, "running");
  // hitl outranks blocked
  assert.equal(nextAction({ ...base(), hitl: HITL, status: "blocked" }).kind, "approve");
  // empty phases outranks complete (console checks phases.length first)
  assert.equal(nextAction({ ...base(), phases: [], status: "complete" }).kind, "unknown");
  // a failed gate outranks the rejected-run arm
  assert.equal(nextAction(withPhase0({ status: "rejected", gate: RED_GATE })).kind, "fix-gate");
});

test("TASK-01 envelope: summary() carries nextAction (identical to nextAction()) and stays JSON-safe", () => {
  const p = base();
  const s = summary(p);
  assert.deepEqual(s.nextAction, nextAction(p));
  assert.equal(s.nextAction.kind, "run", "fresh intake project: run the next phase");
  assert.equal(s.nextAction.cmd, "gate");
  assert.equal(s.nextAction.phase, 0);
  const round = JSON.parse(JSON.stringify(s));
  assert.equal(round.nextAction.kind, "run", "nextAction survives serialization");
});
