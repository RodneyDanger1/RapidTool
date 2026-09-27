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
});
