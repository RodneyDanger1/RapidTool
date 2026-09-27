// ---------------------------------------------------------------------------
// quarantine.test.ts — R11-f08 (W30 S4): the forced-emit quarantine move.
// Run: node --experimental-strip-types --test src/lib/quarantine.test.ts
// ---------------------------------------------------------------------------
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { quarantineFiles, quarantineStamp, QUARANTINE_DIR_NAME } from "./quarantine.ts";

let root: string;

before(() => {
  root = mkdtempSync(join(tmpdir(), "rt-quarantine-"));
});

after(() => {
  rmSync(root, { recursive: true, force: true });
});

function seed(dir: string, rel: string, body: string): void {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), body);
}

describe("quarantineFiles (R11-f08)", () => {
  it("moves foreign files aside under .rapidtool-quarantine/<ts>/ and returns the list", async () => {
    const dir = join(root, "emit-basic");
    seed(dir, "NOTES.md", "user notes");
    seed(dir, "docs/scratch.txt", "scratch");
    seed(dir, "src/index.ts", "kept (intended)");

    const res = await quarantineFiles(dir, ["NOTES.md", "docs/scratch.txt"], { ts: "2026-01-02T03-04-05Z" });

    assert.equal(res.ok, true);
    assert.deepEqual(res.moved, ["NOTES.md", "docs/scratch.txt"]);
    assert.deepEqual(res.missing, []);
    assert.deepEqual(res.failed, []);
    assert.equal(res.quarantineDir, join(dir, QUARANTINE_DIR_NAME, "2026-01-02T03-04-05Z"));

    // moved ≠ deleted: bytes are recoverable at the quarantine path
    assert.equal(existsSync(join(dir, "NOTES.md")), false);
    assert.equal(
      readFileSync(join(dir, QUARANTINE_DIR_NAME, "2026-01-02T03-04-05Z", "NOTES.md"), "utf8"),
      "user notes",
    );
    assert.equal(
      readFileSync(join(dir, QUARANTINE_DIR_NAME, "2026-01-02T03-04-05Z", "docs/scratch.txt"), "utf8"),
      "scratch",
    );
    // the intended file is untouched — quarantine is additive over the tree
    assert.equal(readFileSync(join(dir, "src/index.ts"), "utf8"), "kept (intended)");
  });

  it("reports an already-gone path as missing (never a silent drop)", async () => {
    const dir = join(root, "emit-missing");
    mkdirSync(dir, { recursive: true });
    const res = await quarantineFiles(dir, ["GONE.md"], { ts: "t" });
    assert.equal(res.ok, true);
    assert.deepEqual(res.moved, []);
    assert.deepEqual(res.missing, ["GONE.md"]);
    assert.deepEqual(res.failed, []);
  });

  it("refuses a path that escapes the emit dir (failed, nothing moved outside)", async () => {
    const dir = join(root, "emit-escape");
    mkdirSync(dir, { recursive: true });
    const outside = join(root, "outside.txt");
    writeFileSync(outside, "keep me");
    const res = await quarantineFiles(dir, ["../outside.txt"], { ts: "t" });
    assert.equal(res.ok, false);
    assert.equal(res.failed.length, 1);
    assert.match(res.failed[0].error, /escapes the emit dir/);
    assert.equal(readFileSync(outside, "utf8"), "keep me");
  });

  it("no requested paths → no quarantine dir created (pure no-op)", async () => {
    const dir = join(root, "emit-none");
    mkdirSync(dir, { recursive: true });
    const res = await quarantineFiles(dir, [], { ts: "t" });
    assert.equal(res.ok, true);
    assert.equal(res.quarantineDir, null);
    assert.equal(existsSync(join(dir, QUARANTINE_DIR_NAME)), false);
  });

  it("quarantineStamp is Windows-legal and time-derived", () => {
    const s = quarantineStamp(0);
    assert.equal(s, "1970-01-01T00-00-00-000Z");
    assert.doesNotMatch(s, /[:.]/);
  });
});
