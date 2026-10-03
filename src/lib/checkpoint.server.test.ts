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
import { checkpointSupersededBy, loadResumableCheckpoint } from "./headless.ts";

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

      // A1-07: the integer out-of-graph upper bound is enforced at READ time,
      // not only at checkpointAdmits — a hand-edited `run.phase: 13` must be
      // refused here (the reader proves the shape before any caller sees it).
      writeFileSync(
        path,
        JSON.stringify({
          version: CHECKPOINT_VERSION,
          savedAt: Date.now(),
          run: { phase: PHASES.length, step: 0, mode: "keyless" },
          project: { id: "p", phases: [{ id: 0 }] },
        }),
        "utf8",
      );
      const outOfGraph = readCheckpoint(dir);
      assert.equal(outOfGraph.ok, false, "an out-of-graph integer phase is refused at READ time too (A1-07)");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("A1-07 savedAt boundary: a stored non-finite/absent savedAt is refused at READ time", () => {
    const dir = tempDir();
    try {
      const path = checkpointPath(dir);
      mkdirSync(join(dir, ".rapidtool"), { recursive: true });
      const shape = (savedAt: unknown) => ({
        version: CHECKPOINT_VERSION,
        savedAt,
        run: { phase: 1, step: 0, mode: "keyless" },
        project: { id: "p", phases: [{ id: 0 }] },
      });
      // "x" / null / NaN (→ JSON null) / absent (undefined is dropped by
      // JSON.stringify) — every non-finite shape must be a coded refusal, so a
      // hand-edited snapshot cannot surface a NaN age to the resume arm.
      for (const bad of ["x", null, undefined, Number.NaN] as unknown[]) {
        writeFileSync(path, JSON.stringify(shape(bad)), "utf8");
        const read = readCheckpoint(dir);
        assert.equal(read.ok, false, `savedAt=${String(bad)} must be refused at read time`);
        if (!read.ok) assert.equal(read.code, "RT_E_VALIDATION");
        const resumed = loadResumableCheckpoint(dir, { projectId: "p", mode: "keyless" });
        assert.equal(resumed.ok, false, `resume must refuse savedAt=${String(bad)}`);
        if (!resumed.ok) assert.equal(resumed.code, "RT_E_VALIDATION");
      }
      // Control: a finite savedAt is admitted (the guard must not over-refuse).
      writeFileSync(path, JSON.stringify(shape(12_345)), "utf8");
      assert.equal(readCheckpoint(dir).ok, true);
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

  // -------------------------------------------------------------------------
  // fixes/336 · 336-2 (Ledger): the RETRY-after-rejection shape. `reject`
  // flips the file edge to rejected/blocked (superseded, above); `retry`
  // unlocks it back to ready/running and KEEPS `rejectionHistory`, but the
  // per-phase snapshot was written BEFORE the rejection and is never updated
  // by reject/retry. Pre-fix the verdict was superseded:false, so `resume`
  // re-drove from the stale snapshot and silently rewound the file:
  // live keyless probe — before resume status running / edge ready /
  // rejectionHistory 1 / decisions 1; after resume awaiting_hitl / 0 / 0.
  // The file holds human history the snapshot cannot describe.
  // -------------------------------------------------------------------------
  it("336-2: a file RETRIED after a rejection is superseded — the snapshot predates the rejection record", () => {
    const verdict = checkpointSupersededBy(
      snap(), // snapshot: P4 awaiting_hitl, no rejection history
      4,
      snap({
        status: "running",
        phases: [
          { id: 0, status: "complete" },
          { id: 1, status: "complete" },
          { id: 2, status: "complete" },
          { id: 3, status: "complete" },
          { id: 4, status: "ready", rejectionHistory: [{ note: "probe reject", at: 1 }] },
        ],
      }),
    );
    assert.equal(verdict.superseded, true, "a retried edge carrying rejection history must not be resumed over");
    assert.match(String(verdict.reason), /rejection/);
    // The designed re-park shape stays resumable: a ready edge with NO
    // rejection history has nothing the snapshot cannot describe.
    assert.equal(
      checkpointSupersededBy(
        snap(),
        4,
        snap({ phases: [...snap().phases.slice(0, 4), { id: 4, status: "ready" }] }),
      ).superseded,
      false,
      "a never-rejected ready edge stays the designed re-entry shape",
    );
  });

  // -------------------------------------------------------------------------
  // fixes/336 · 336-2 (Ledger): the NON-DRIVE mutation shape (`ingest`). A
  // report lands artifacts at the current edge without refreshing the per-phase
  // snapshot, so the pre-fix verdict was superseded:false and `resume` rewrote
  // the file from the snapshot — DROPPING the ingested work (live keyless
  // probe: park P4 / 11 artifacts → ingest → 12 → resume → 11, the report gone).
  // A normal park leaves checkpoint and file array counts EQUAL (measured:
  // 20/20 artifacts, 32/32 logs, 13/13 memory, 2/2 decisions), so "the file has
  // more rows than the snapshot" means the file holds work the snapshot lacks.
  // -------------------------------------------------------------------------
  it("336-2: a file that GAINED artifacts since the snapshot is superseded — resume would drop ingested work", () => {
    const one = snap({
      artifacts: [{ id: "a-1", phase: 4, kind: "gate", title: "P4 gate", body: "ok" }],
    } as Partial<Project>);
    const two = snap({
      artifacts: [
        { id: "a-1", phase: 4, kind: "gate", title: "P4 gate", body: "ok" },
        { id: "report-1", phase: 4, kind: "docs", title: "[agent report] ingested", body: "work" },
      ],
    } as Partial<Project>);
    const verdict = checkpointSupersededBy(one, 4, two);
    assert.equal(verdict.superseded, true, "artifacts the snapshot lacks must never be rewound away");
    assert.match(String(verdict.reason), /artifact/);
    // The designed park shape (equal rows) stays resumable.
    assert.equal(checkpointSupersededBy(one, 4, one).superseded, false, "no growth ⇒ the snapshot stays the re-entry point");
  });
});

// ---------------------------------------------------------------------------
// fixes/336 · 336-2 (Ledger): the RESUME seam — read → admit → hydrate →
// re-entry (`headless.loadResumableCheckpoint`). No test reached this seam
// before; the CLI probes in fixes/336_2_ledger.md carry the fresh-process half,
// these pin the coded branch behaviour. Deterministic: explicit ask.projectId /
// ask.mode, so the ambient DEEPSEEK_API_KEY never leaks into the mode.
// ---------------------------------------------------------------------------
describe("336-2 — the resume seam: read → admit → hydrate, coded refusals", () => {
  const RUN1: CheckpointRun = { phase: 1, step: 0, mode: "keyless" };
  /** A project that really carries a record for the recorded re-entry phase. */
  const resumableProject = (id: string): Project =>
    ({
      id,
      phases: [
        { id: 0, status: "complete" },
        { id: 1, status: "awaiting_hitl" },
      ],
      logs: [],
      decisions: [],
    }) as unknown as Project;

  it("happy path: the recorded phase is the re-entry point and the project is HYDRATED", () => {
    const dir = tempDir();
    try {
      const written = writeCheckpoint(dir, resumableProject("p-res"), RUN1);
      assert.equal(written.ok, true);
      const resumed = loadResumableCheckpoint(dir, { projectId: "p-res", mode: "keyless" });
      assert.equal(resumed.ok, true);
      if (!resumed.ok) return;
      assert.equal(resumed.project.id, "p-res");
      assert.equal(resumed.project.currentPhase, 1, "re-entry is at the recorded phase, not P0");
      assert.deepEqual(resumed.resumedFrom, { phase: 1, step: 0 }, "the envelope names the re-entry coordinates");
      assert.equal((resumed.project as { _v?: number })._v, 2, "hydrateProject ran — the raw snapshot is never returned");
      assert.ok(resumed.savedAt > 0);
      assert.equal(resumed.path, checkpointPath(dir));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the snapshot round-trip keeps every phase record, its gate verdict, and the artifacts", () => {
    const dir = tempDir();
    try {
      const gate = { passed: true, unmet: [], evidenceHash: "h-1", checkedAt: 42 };
      const project = {
        id: "p-gate",
        phases: [
          { id: 0, status: "complete", gate, startedAt: 1 },
          { id: 1, status: "awaiting_hitl" },
        ],
        logs: [],
        decisions: [],
        artifacts: [
          { id: "a-1", phase: 0, kind: "gate", title: "P0 gate", body: "ok", createdAt: 1 },
          { id: "a-2", phase: 0, kind: "scorecard", title: "P0 scorecard", body: "ok", createdAt: 2 },
        ],
      } as unknown as Project;
      assert.equal(writeCheckpoint(dir, project, { phase: 1, step: 0, mode: "keyless" }).ok, true);
      const resumed = loadResumableCheckpoint(dir, { projectId: "p-gate", mode: "keyless" });
      assert.equal(resumed.ok, true);
      if (!resumed.ok) return;
      // hydrateProject's repairPhases re-inserts the phases the minimal snapshot
      // never carried (as locked placeholders) — the ORIGINAL records must still
      // be present and unchanged, never dropped.
      assert.equal(resumed.project.phases.find((r) => r.id === 0)?.status, "complete");
      assert.equal(resumed.project.phases.find((r) => r.id === 1)?.status, "awaiting_hitl");
      assert.deepEqual(resumed.project.phases.find((r) => r.id === 0)?.gate, gate, "the P0 gate verdict survives");
      assert.deepEqual(
        resumed.project.artifacts.map((a) => a.id),
        ["a-1", "a-2"],
        "every artifact survives the snapshot round-trip (park path keeps the work)",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refusal: identity mismatch — a snapshot is never hydrated for a different project", () => {
    const dir = tempDir();
    try {
      assert.equal(writeCheckpoint(dir, resumableProject("p-res"), RUN1).ok, true);
      const resumed = loadResumableCheckpoint(dir, { projectId: "p-other", mode: "keyless" });
      assert.equal(resumed.ok, false);
      if (!resumed.ok) {
        assert.equal(resumed.code, "RT_E_VALIDATION");
        assert.match(resumed.error, /project mismatch/);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refusal: mode mismatch — a keyed snapshot never resumes keyless and vice versa", () => {
    const dir = tempDir();
    try {
      assert.equal(writeCheckpoint(dir, resumableProject("p-res"), RUN1).ok, true);
      const resumed = loadResumableCheckpoint(dir, { projectId: "p-res", mode: "keyed" });
      assert.equal(resumed.ok, false);
      if (!resumed.ok) {
        assert.equal(resumed.code, "RT_E_VALIDATION");
        assert.match(resumed.error, /mode mismatch/);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refusal A20: a snapshot with no phase record for its recorded phase is refused (internal incoherence)", () => {
    const dir = tempDir();
    try {
      // The writer only checks the run shape; the project's phase list can
      // legitimately lack the recorded id (a foreign/hand-built payload) —
      // the reader must refuse rather than hydrate an edge it cannot describe.
      assert.equal(writeCheckpoint(dir, fixtureProject("p-res"), { phase: 1, step: 0, mode: "keyless" }).ok, true);
      const resumed = loadResumableCheckpoint(dir, { projectId: "p-res", mode: "keyless" });
      assert.equal(resumed.ok, false);
      if (!resumed.ok) {
        assert.equal(resumed.code, "RT_E_VALIDATION");
        assert.match(resumed.error, /no phase record/);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refusal: no checkpoint at a real path is RT_E_CHECKPOINT_MISSING (never a silent fresh start)", () => {
    const dir = tempDir();
    try {
      const resumed = loadResumableCheckpoint(dir, { mode: "keyless" });
      assert.equal(resumed.ok, false);
      if (!resumed.ok) assert.equal(resumed.code, "RT_E_CHECKPOINT_MISSING");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refusal: junk bytes are RT_E_VALIDATION — resume never guesses", () => {
    const dir = tempDir();
    try {
      mkdirSync(join(dir, ".rapidtool"), { recursive: true });
      writeFileSync(checkpointPath(dir), "{not json", "utf8");
      const resumed = loadResumableCheckpoint(dir, { mode: "keyless" });
      assert.equal(resumed.ok, false);
      if (!resumed.ok) assert.equal(resumed.code, "RT_E_VALIDATION");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
