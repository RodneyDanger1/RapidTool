// ---------------------------------------------------------------------------
// write-set.test.ts — 174-F8 SSSF-style write-set rollback library
// (src/lib/write-set.ts). Snapshot → write → rollback. NOT a sandbox.
// Run: node --experimental-strip-types --test src/lib/write-set.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyWrite, applyWrites, assertSafeRelPath, rollback, snapshotPaths } from "./write-set.ts";
import { ERROR_CODES } from "./errors.ts";

const tmp = (): string => mkdtempSync(join(tmpdir(), "rapidtool-writeset-"));

describe("write-set — snapshotPaths / applyWrite / rollback", () => {
  it("write then rollback restores exact prior bytes", () => {
    const root = tmp();
    try {
      mkdirSync(join(root, "src"), { recursive: true });
      const rel = "src/generated.ts";
      const prior = "export const prior = 1;\n";
      writeFileSync(join(root, rel), prior, "utf8");

      const snap = snapshotPaths(root, [rel]);
      const rec = snap.get(rel);
      assert.ok(rec, "snapshot records the relative path");
      assert.equal(rec!.existed, true);
      assert.equal(rec!.bytes, prior);

      applyWrite(root, rel, "export const mutated = 2;\n", snap);
      assert.equal(readFileSync(join(root, rel), "utf8"), "export const mutated = 2;\n");

      rollback(root, snap);
      assert.equal(readFileSync(join(root, rel), "utf8"), prior);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("new file is unlinked on rollback", () => {
    const root = tmp();
    try {
      mkdirSync(root, { recursive: true });
      const rel = "src/jobs/record.ts";
      const snap = snapshotPaths(root, [rel]);
      const rec = snap.get(rel);
      assert.ok(rec);
      assert.equal(rec!.existed, false);
      assert.equal(rec!.bytes, null);
      assert.equal(existsSync(join(root, rel)), false);

      applyWrite(root, rel, "export function record() { return 1; }\n", snap);
      assert.equal(existsSync(join(root, rel)), true);

      rollback(root, snap);
      assert.equal(existsSync(join(root, rel)), false, "new file must be unlinked");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("missing root does not throw", () => {
    const root = join(tmpdir(), "rapidtool-writeset-missing-root-does-not-exist");
    rmSync(root, { recursive: true, force: true });
    assert.equal(existsSync(root), false);

    assert.doesNotThrow(() => {
      const snap = snapshotPaths(root, ["a.ts", "nested/b.ts"]);
      assert.equal(snap.get("a.ts")?.existed, false);
      assert.equal(snap.get("a.ts")?.bytes, null);
      assert.equal(snap.get("nested/b.ts")?.existed, false);
      rollback(root, snap);
    });
  });

  it("applyWrite records prior bytes once, then writes (second write keeps original record)", () => {
    const root = tmp();
    try {
      mkdirSync(join(root, "src"), { recursive: true });
      const rel = "src/keep.ts";
      writeFileSync(join(root, rel), "v1\n", "utf8");
      const snap = snapshotPaths(root, []);
      applyWrite(root, rel, "v2\n", snap);
      applyWrite(root, rel, "v3\n", snap);
      assert.equal(snap.get(rel)?.existed, true);
      assert.equal(snap.get(rel)?.bytes, "v1\n", "snapshot must keep the first recorded bytes");
      rollback(root, snap);
      assert.equal(readFileSync(join(root, rel), "utf8"), "v1\n");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("assertSafeRelPath refuses absolute and .. escape", () => {
    assert.equal(assertSafeRelPath("src/a.ts").includes(".."), false);
    assert.throws(() => assertSafeRelPath("../etc/passwd"), /escape|absolute/i);
    assert.throws(() => assertSafeRelPath("foo/../../bar"), /escape/i);
    assert.throws(() => assertSafeRelPath("/abs/path"), /absolute/i);
    assert.throws(() => applyWrite(tmp(), "../escape.ts", "x"), /escape|absolute/i);
  });

  it("assertSafeRelPath refuses the empty string (by-design refusal, H1 probe)", () => {
    // W40 N1: ws.assertSafeRelPath-empty is a REFUSAL by design (H1 probe
    // case) — pin it so the refusal claim is genuinely "by design — tested".
    assert.throws(() => assertSafeRelPath(""), /relative path required/i);
  });

  it("applyWrites rolls back the whole set when a later write fails", () => {
    const root = tmp();
    try {
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(join(root, "src/keep.ts"), "prior\n", "utf8");
      const snap = snapshotPaths(root, ["src/keep.ts"]);

      // Poison path: second entry escapes → throws after first write recorded/applied.
      assert.throws(
        () =>
          applyWrites(
            root,
            [
              { path: "src/keep.ts", body: "mutated\n" },
              { path: "../escape.ts", body: "nope\n" },
            ],
            snap,
          ),
        /escape|absolute/i,
      );
      assert.equal(readFileSync(join(root, "src/keep.ts"), "utf8"), "prior\n", "first write rolled back");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("applyWrites success leaves all bodies and snapshot first-write-wins", () => {
    const root = tmp();
    try {
      mkdirSync(root, { recursive: true });
      const snap = applyWrites(root, [
        { path: "a.ts", body: "A\n" },
        { path: "b/c.ts", body: "C\n" },
      ]);
      assert.equal(readFileSync(join(root, "a.ts"), "utf8"), "A\n");
      assert.equal(readFileSync(join(root, "b/c.ts"), "utf8"), "C\n");
      assert.equal(snap.get("a.ts")?.existed, false);
      rollback(root, snap);
      assert.equal(existsSync(join(root, "a.ts")), false);
      assert.equal(existsSync(join(root, "b/c.ts")), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // W60/346-6 C1: the path-class refusals are MACHINE failures — each carries
  // its registered RT_E code so emit callers branch on the code, not prose.
  it("path-class refusals carry a registered RT_E code (never bare prose)", () => {
    const codeOf = (fn: () => unknown): string | undefined => {
      try {
        fn();
      } catch (e) {
        return (e as { code?: string }).code;
      }
      return undefined;
    };
    assert.equal(codeOf(() => assertSafeRelPath("")), "RT_E_VALIDATION");
    assert.equal(codeOf(() => assertSafeRelPath("a\0b")), "RT_E_VALIDATION");
    assert.equal(codeOf(() => assertSafeRelPath("/abs/path")), "RT_E_VALIDATION");
    assert.equal(codeOf(() => assertSafeRelPath("../etc/passwd")), "RT_E_VALIDATION");
    assert.ok((ERROR_CODES as readonly string[]).includes("RT_E_VALIDATION"));
    assert.ok((ERROR_CODES as readonly string[]).includes("RT_E_PATH_KIND_MISMATCH"));
  });

  it("a physically-escaping junction is RT_E_PATH_KIND_MISMATCH (wrong-kind path, not validation)", (t) => {
    const base = tmp();
    const outside = tmp();
    try {
      const root = join(base, "root");
      mkdirSync(root, { recursive: true });
      writeFileSync(join(outside, "f.ts"), "x\n", "utf8");
      try {
        symlinkSync(outside, join(root, "link"), process.platform === "win32" ? "junction" : undefined);
      } catch (err) {
        if (process.platform === "win32" && (err as { code?: string }).code === "EPERM") {
          t.skip("junction needs Developer Mode on Windows (EPERM)");
          return;
        }
        throw err;
      }
      let caught: { code?: string } | null = null;
      try {
        snapshotPaths(root, ["link/f.ts"]);
      } catch (e) {
        caught = e as { code?: string };
      }
      assert.ok(caught, "a junction escaping root must be refused");
      assert.equal(caught!.code, "RT_E_PATH_KIND_MISMATCH");
    } finally {
      rmSync(base, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });
});
