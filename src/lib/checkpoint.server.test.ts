/**
 * W36 lane N2 (fixes/281) — the §A1 checkpoint-hardening pins.
 *
 * Every case maps to one code-notes card: A1-01/A1-06 (guards BEFORE join; junk dir = coded
 * refusal on all three ops), A1-02 (partial project refused; bound pass total), A1-04 (run
 * validated in the READER's terms before a byte is written), A1-05 (I/O failures classified —
 * covered indirectly: the refusal codes flow through classifyError), A1-07 (admits phase sanity
 * + savedAt), A1-08 (pid-suffixed staging; clear sweeps stale staging), A1-09 (minimal read).
 *
 * House rules honored: cwd-independent (mkdtemp under tmpdir, cleanup in finally), no network,
 * keyless, no process state touched.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CHECKPOINT_CAPS,
  CHECKPOINT_VERSION,
  boundProjectForCheckpoint,
  checkpointAdmits,
  checkpointPath,
  clearCheckpoint,
  readCheckpoint,
  writeCheckpoint,
  type CheckpointRun,
  type RunCheckpoint,
} from "./checkpoint.server.ts";
import { PHASES } from "./phases.ts";
import type { Project } from "./types.ts";
import { checkpointSupersededBy } from "./headless.ts";

const tempDir = (): string => mkdtempSync(join(tmpdir(), "rapidtool-ckpt-"));

/** The minimal REAL project the writer requires (id + non-empty phases + logs/decisions arrays). */
function fixtureProject(id = "p-test"): Project {
  return {
    id,
    phases: [{ id: 0, status: "complete" }],
    logs: [],
    decisions: [],
  } as unknown as Project;
}

const RUN: CheckpointRun = { phase: 1, step: 0, mode: "keyless" };

describe("checkpoint.server — the §A1 hardening pins (W36 N2)", () => {
  it("A1-01/A1-06: a junk projectDir is a CODED refusal on every op — never a throw, never a fabricated path", () => {
    const read = readCheckpoint(undefined as never);
    assert.equal(read.ok, false);
    if (read.ok) return;
    assert.equal(read.code, "RT_E_VALIDATION");
    assert.equal(read.path, "", "no fabricated relative path on an argument refusal");

    const readEmpty = readCheckpoint("");
    assert.equal(readEmpty.ok, false);
    if (!readEmpty.ok) {
      assert.equal(readEmpty.code, "RT_E_VALIDATION", "empty dir is the SAME class as write/clear (A1-05)");
      assert.equal(readEmpty.path, "");
    }

    const cleared = clearCheckpoint(undefined as never);
    assert.equal(cleared.ok, false);

    const written = writeCheckpoint(undefined as never, fixtureProject(), RUN);
    assert.equal(written.ok, false);
    if (!written.ok) assert.equal(written.code, "RT_E_VALIDATION");
  });

  it("A1-02/A1-04: a partial project and a bad run shape are refused; NO file is created", () => {
    const dir = tempDir();
    try {
      const partial = writeCheckpoint(dir, { id: "x", phases: [{ id: 0, status: "complete" }] } as Project, RUN);
      assert.equal(partial.ok, false);
      assert.equal(existsSync(checkpointPath(dir)), false, "refusal must not create a file");

      const badMode = writeCheckpoint(dir, fixtureProject(), { phase: 1, step: 0, mode: "Keyed" } as never);
      assert.equal(badMode.ok, false, "case-slipped mode is refused (A1-04: the reader would refuse it)");

      const fractional = writeCheckpoint(dir, fixtureProject(), { phase: 1.5, step: 0, mode: "keyless" } as never);
      assert.equal(fractional.ok, false, "fractional phase is refused (integer >= 0)");

      const outOfGraph = writeCheckpoint(dir, fixtureProject(), { phase: 99, step: 0, mode: "keyless" } as never);
      assert.equal(outOfGraph.ok, false, "phase beyond the graph range is refused (A1-07)");

      assert.equal(existsSync(checkpointPath(dir)), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("happy path: write → read-back → clear; the payload carries the validated run", () => {
    const dir = tempDir();
    try {
      const written = writeCheckpoint(dir, fixtureProject("p-ok"), { phase: 2, step: 0, mode: "keyless" });
      assert.equal(written.ok, true);
      if (!written.ok) return;
      assert.ok(written.bytes > 0);

      const read = readCheckpoint(dir);
      assert.equal(read.ok, true);
      if (!read.ok) return;
      assert.equal(read.checkpoint.version, CHECKPOINT_VERSION);
      assert.equal(read.checkpoint.run.phase, 2);
      assert.equal(read.checkpoint.project.id, "p-ok");
      assert.ok(Number.isFinite(read.checkpoint.savedAt));

      // A1-08: no staging residue after a completed write.
      const residue = readdirSync(join(dir, ".rapidtool")).filter((n) => n.endsWith(".tmp"));
      assert.deepEqual(residue, [], "no *.tmp may survive a successful write");

      assert.deepEqual(clearCheckpoint(dir), { ok: true });
      const after = readCheckpoint(dir);
      assert.equal(after.ok, false);
      if (!after.ok) assert.equal(after.code, "RT_E_CHECKPOINT_MISSING");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reader: junk bytes / junk shape / fractional phase are VALIDATION refusals, never throws", () => {
    const dir = tempDir();
    try {
      const path = checkpointPath(dir);
      mkdirSync(join(dir, ".rapidtool"), { recursive: true });

      writeFileSync(path, "{not json", "utf8");
      const notJson = readCheckpoint(dir);
      assert.equal(notJson.ok, false);
      if (!notJson.ok) assert.equal(notJson.code, "RT_E_VALIDATION");

      writeFileSync(path, JSON.stringify({ version: CHECKPOINT_VERSION, savedAt: 1, run: { phase: 1 } }), "utf8");
      const junkShape = readCheckpoint(dir);
      assert.equal(junkShape.ok, false);

      writeFileSync(
        path,
        JSON.stringify({
          version: CHECKPOINT_VERSION,
          savedAt: Date.now(),
          run: { phase: 1.5, step: 0, mode: "keyless" },
          project: { id: "p", phases: [{ id: 0 }] },
        }),
        "utf8",
      );
      const fractional = readCheckpoint(dir);
      assert.equal(fractional.ok, false, "fractional phase refused at READ time too (A1-07)");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("A1-07: checkpointAdmits fails closed on phase 99 / 1.5, mismatch; surfaces savedAt on success", () => {
    const base: RunCheckpoint = {
      version: CHECKPOINT_VERSION,
      savedAt: 12345,
      run: { phase: 1, step: 0, mode: "keyless" },
      project: fixtureProject("p-adm"),
    };
    const phase99 = checkpointAdmits({ ...base, run: { phase: 99, step: 0, mode: "keyless" } }, {
      projectId: "p-adm",
      mode: "keyless",
    });
    assert.equal(phase99.ok, false, "phase 99 must fail closed (A1-07)");

    const fractional = checkpointAdmits({ ...base, run: { phase: 1.5, step: 0, mode: "keyless" } }, {
      projectId: "p-adm",
      mode: "keyless",
    });
    assert.equal(fractional.ok, false);

    const tooHigh = checkpointAdmits(
      { ...base, run: { phase: PHASES.length, step: 0, mode: "keyless" } },
      { projectId: "p-adm", mode: "keyless" },
    );
    assert.equal(tooHigh.ok, false, "one past the graph's last phase fails closed (A1-07)");

    const lastOk = checkpointAdmits(
      { ...base, run: { phase: PHASES.length - 1, step: 0, mode: "keyless" } },
      { projectId: "p-adm", mode: "keyless" },
    );
    assert.equal(lastOk.ok, true, "the graph's last phase is a valid re-entry point");

    const mismatch = checkpointAdmits(base, { projectId: "p-other", mode: "keyless" });
    assert.equal(mismatch.ok, false);

    const modeMismatch = checkpointAdmits(base, { projectId: "p-adm", mode: "keyed" });
    assert.equal(modeMismatch.ok, false);

    const ok = checkpointAdmits(base, { projectId: "p-adm", mode: "keyless" });
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.savedAt, 12345, "savedAt surfaced so the CLI prints the snapshot age");
  });

  it("A1-08: clear sweeps stale staging (legacy fixed name + pid-suffixed)", () => {
    const dir = tempDir();
    try {
      const rt = join(dir, ".rapidtool");
      mkdirSync(rt, { recursive: true });
      writeFileSync(join(rt, "checkpoint.json"), "{}", "utf8");
      writeFileSync(join(rt, "checkpoint.json.tmp"), "legacy", "utf8");
      writeFileSync(join(rt, "checkpoint.json.1234.5678.tmp"), "stale", "utf8");
      writeFileSync(join(rt, "unrelated.txt"), "keep", "utf8");

      assert.deepEqual(clearCheckpoint(dir), { ok: true });
      const left = readdirSync(rt);
      assert.deepEqual(left, ["unrelated.txt"], "sweep is bounded to checkpoint.json* staging");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("A1-02: the bound pass is TOTAL on junk arrays and caps the tail", () => {
    const junk = boundProjectForCheckpoint({ ...fixtureProject(), logs: undefined, chatLog: "nope" } as unknown as Project);
    assert.deepEqual(junk.logs, []);
    assert.deepEqual(junk.chatLog, []);

    const rows = Array.from({ length: 300 }, (_, i) => ({ n: i }));
    const bounded = boundProjectForCheckpoint({ ...fixtureProject(), logs: rows, chatLog: rows } as unknown as Project);
    assert.equal(bounded.logs.length, CHECKPOINT_CAPS.logs, "tail-capped to CHECKPOINT_CAPS.logs");
    assert.equal((bounded.logs[bounded.logs.length - 1] as unknown as { n: number }).n, 299, "keeps the NEWEST rows");
    assert.equal((bounded.chatLog ?? []).length, CHECKPOINT_CAPS.chatLog);
  });

  it("A3/M3-08: a null/non-object ask is a coded refusal — never a TypeError from ask.projectId", () => {
    const base: RunCheckpoint = {
      version: CHECKPOINT_VERSION,
      savedAt: 7,
      run: { phase: 1, step: 0, mode: "keyless" },
      project: fixtureProject("p-ask"),
    };
    const refused = checkpointAdmits(base, null as unknown as { projectId: string; mode: "keyless" });
    assert.equal(refused.ok, false);
    assert.equal(refused.ok === false && refused.code, "RT_E_VALIDATION");
    assert.ok(refused.ok === false && /ask must be/.test(refused.error));
    assert.equal(checkpointAdmits(base, undefined as unknown as { projectId: string; mode: "keyless" }).ok, false);
    assert.equal(
      checkpointAdmits(base, 42 as unknown as { projectId: string; mode: "keyless" }).ok,
      false,
      "a scalar ask is shape-refused too",
    );
  });

  it("A3/M3-09: boundProjectForCheckpoint(null) yields the empty bounded copy — never a TypeError", () => {
    const out = boundProjectForCheckpoint(null as unknown as Project);
    assert.deepEqual(out, { logs: [], decisions: [], memory: [], artifacts: [], research: [], chatLog: [] });
  });
});

// ---------------------------------------------------------------------------
// fixes/323 FIX-2c (window #4 item 2 · X2b OBS): the checkpoint-STALENESS
// comparison — a snapshot the named project FILE has moved past (id / seal /
// brief / phase / state) reports superseded so resume/unattended ignore it
// WITH a notice instead of silently rewinding the file. Live pre-fix repro
// (keyless, 2026-09-30): `gate` parks at P4 (snapshot phase 4); `approve
// --seat autopilot` moves the file to P5/running; the next `unattended`
// resumed the P4 snapshot (steps:0) and rewound the on-disk file to
// P4/awaiting_hitl. Post-fix the same call ignores the snapshot
// (`checkpoint.ignored:true`) and the file stays at P5.
// ---------------------------------------------------------------------------
describe("FIX-2c — checkpoint staleness vs the named project file (X2b OBS)", () => {
  const snap = (over: Partial<Project> = {}): Project =>
    ({
      id: "p-1",
      brief: "intent",
      status: "awaiting_hitl",
      currentPhase: 4,
      phases: [
        { id: 0, status: "complete" },
        { id: 1, status: "complete" },
        { id: 2, status: "complete" },
        { id: 3, status: "complete" },
        { id: 4, status: "pending" },
      ],
      ...over,
    }) as unknown as Project;

  it("file at P5 vs snapshot re-entry P4 → superseded; the reason names both phases (the X2b shape)", () => {
    const verdict = checkpointSupersededBy(snap(), 4, snap({ currentPhase: 5, status: "running" }));
    assert.equal(verdict.superseded, true);
    assert.match(String(verdict.reason), /P5/);
    assert.match(String(verdict.reason), /P4/);
  });

  it("a file BEHIND the snapshot is NOT superseded — that is the crash-recovery shape resume exists for", () => {
    const verdict = checkpointSupersededBy(
      snap(),
      4,
      snap({
        currentPhase: 2,
        status: "running",
        phases: [
          { id: 0, status: "complete" },
          { id: 1, status: "complete" },
          { id: 2, status: "ready" },
        ],
      }),
    );
    assert.equal(verdict.superseded, false, "the file lagging the per-phase commits is the designed resume case");
    assert.equal(verdict.reason, null);
  });

  it("the normal post-park shape (same phase/state) is NOT superseded — the designed resume stays", () => {
    const verdict = checkpointSupersededBy(snap(), 4, snap());
    assert.equal(verdict.superseded, false);
  });

  it("a sealed-complete file is superseded — a leftover snapshot must not rewind a terminal seal", () => {
    const verdict = checkpointSupersededBy(snap(), 4, snap({ status: "complete", currentPhase: 12 }));
    assert.equal(verdict.superseded, true);
    assert.match(String(verdict.reason), /complete/);
  });

  it("an id mismatch is superseded first (a dir reused by a different project) — before any phase math", () => {
    const verdict = checkpointSupersededBy(snap(), 4, snap({ id: "p-2", currentPhase: 4 }));
    assert.equal(verdict.superseded, true);
    assert.match(String(verdict.reason), /p-2/);
    assert.match(String(verdict.reason), /p-1/);
  });

  it("a brief divergence is superseded — the snapshot no longer describes the file's intent", () => {
    const verdict = checkpointSupersededBy(snap(), 4, snap({ brief: "different intent" }));
    assert.equal(verdict.superseded, true);
    assert.match(String(verdict.reason), /brief differs/);
  });

  it("a file recording MORE completed phases at the same cursor is superseded — it knows work the snapshot does not", () => {
    const verdict = checkpointSupersededBy(
      snap(),
      4,
      snap({
        phases: [
          { id: 0, status: "complete" },
          { id: 1, status: "complete" },
          { id: 2, status: "complete" },
          { id: 3, status: "complete" },
          { id: 4, status: "complete" },
        ],
      }),
    );
    assert.equal(verdict.superseded, true);
    assert.match(String(verdict.reason), /5 completed phase/);
  });

  it("missing data skips its axis — string-less briefs / non-integer phases never false-supersede", () => {
    const noBrief = checkpointSupersededBy(
      snap({ brief: undefined } as Partial<Project>),
      4,
      snap({ brief: undefined } as Partial<Project>),
    );
    assert.equal(noBrief.superseded, false);
    const noPhase = checkpointSupersededBy(snap(), 4, snap({ currentPhase: undefined } as Partial<Project>));
    assert.equal(noPhase.superseded, false);
  });

  // -------------------------------------------------------------------------
  // fixes/325 A4 (edge probe of FIX-2c): a REJECTED file at the SAME edge the
  // snapshot records. Every pre-existing axis reads equal (same id/brief/phase/
  // sealed count) so the pre-fix verdict was superseded:false, and the CLI
  // resume arm then rewrote the file from the snapshot — dropping the
  // rejection note, its decision row and its memory row (live keyless repro:
  // a4_scratch/probe2.mts: blocked/rejected + 1 reject decision → awaiting_hitl
  // + 0 reject decisions). The file is the current truth here.
  // -------------------------------------------------------------------------
  it("325 A4: a file REJECTED at the snapshot's own edge is superseded — the snapshot predates the human rejection", () => {
    const verdict = checkpointSupersededBy(
      snap(), // snapshot: P4 awaiting_hitl, 4 sealed
      4,
      snap({
        status: "blocked",
        phases: [
          { id: 0, status: "complete" },
          { id: 1, status: "complete" },
          { id: 2, status: "complete" },
          { id: 3, status: "complete" },
          { id: 4, status: "rejected" },
        ],
      }),
    );
    assert.equal(verdict.superseded, true, "a rejected file at the snapshot's re-entry edge must never be resumed over");
    assert.match(String(verdict.reason), /rejected P4/);
    // Both markers fire independently: a foreign/persisted payload that only
    // carries the blocked project status (the status rejectHitl stamps) is
    // superseded too, with no rejected record needed.
    const blockedOnly = checkpointSupersededBy(snap(), 4, snap({ status: "blocked" }));
    assert.equal(blockedOnly.superseded, true);
    assert.match(String(blockedOnly.reason), /rejected P4/);
    // The designed shapes are untouched by the new axis: a running/ready file
    // at the same edge, and the post-park awaiting_hitl shape, stay resumable.
    assert.equal(checkpointSupersededBy(snap(), 4, snap({ status: "running" })).superseded, false);
    assert.equal(
      checkpointSupersededBy(
        snap(),
        4,
        snap({ phases: [...snap().phases.slice(0, 4), { id: 4, status: "ready" }] }),
      ).superseded,
      false,
      "a retried (ready) edge is not a rejection — resume may re-park it",
    );
  });
});
