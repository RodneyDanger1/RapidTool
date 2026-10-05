/**
 * W23 L6 (G4 · 249 SPEC 3) — pins for `scanTreeErrorSignals`.
 *
 * The playbook's fixture demand: "a tree with one known swallow". Each case
 * asserts the EXACT finding set (rule + path + line), and the two controls exist
 * to kill the obvious false-positive classes: the masker (a string that looks
 * like a swallow is data) and R3's adjacency window (a neutral return with NO
 * unimplemented marker must not be reported). A scan that reports nothing on the
 * fixture, or throws on the bad dir, FAILS this suite by construction.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { scanTreeErrorSignals } from "./error-scan.server.ts";
import type { ErrorScanFinding } from "./error-scan.server.ts";

/** rule@path:line — the exact-finding-set key (snippets are advisory context). */
const key = (f: ErrorScanFinding): string => `${f.rule}@${f.path}:${f.line}`;

/** Build a fixture tree from `relPath -> source` entries; caller removes it. */
function fixtureTree(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "rt-errscan-"));
  for (const [rel, source] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, source, "utf8");
  }
  return dir;
}

describe("W23 L6 error-scan — planted fixture trees", () => {
  it("R1+R2: an empty catch and a swallowed catch are reported at their exact lines", () => {
    // Lines are pinned by construction (1-based as written below):
    //   5  catch { }            → catch-empty (only a blanked comment inside)
    //   13 catch (err) { return 0; }  → catch-swallowed (no throw/RT_E_/console/report)
    const dir = fixtureTree({
      "swallow.ts": [
        "// fixture: one empty catch + one swallow (G4 rules R1/R2).", // 1
        "export function parse(raw: string): number {", // 2
        "  try {", // 3
        "    return Number(raw);", // 4
        "  } catch {", // 5
        "    /* ignored */", // 6
        "  }", // 7
        "}", // 8
        "", // 9
        "export function soft(raw: string): number {", // 10
        "  try {", // 11
        "    return Number(raw);", // 12
        "  } catch (err) {", // 13
        "    return 0;", // 14
        "  }", // 15
        "}", // 16
        "", // 17
      ].join("\n"),
    });
    try {
      const res = scanTreeErrorSignals(dir);
      assert.equal(res.ok, true, "the scan of a readable fixture tree must succeed");
      if (!res.ok) return;
      assert.equal(res.scanned.files, 1, "one file scanned");
      assert.ok(res.scanned.lines >= 16, "line count is reported (>= the fixture's 16 lines)");
      assert.deepEqual(
        res.findings.map(key),
        ["catch-empty@swallow.ts:5", "catch-swallowed@swallow.ts:13"],
        "exactly the two planted signals — nothing missed, nothing invented",
      );
      assert.ok(
        res.findings.every((f) => f.advisory === true),
        "every finding is labelled advisory (a finding surface, never a gate)",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("line attribution survives a multi-line block comment above the catch (mask keeps index, not newlines)", () => {
    // The masker replaces every masked span with SAME-LENGTH spaces, so a
    // character index is stable — but a block comment's newlines become spaces,
    // so counting lines on the MASKED text under-reports. Before the fix this
    // reported line 3 (two block-comment newlines lost) with a snippet that was
    // not the catch line. The finding must land on the real catch (line 5).
    const dir = fixtureTree({
      "drift.ts": [
        "/**", // 1
        " * multi-line doc — two newlines the masker turns into spaces.", // 2
        " */", // 3
        "export function f(): number {", // 4
        "  try {", // 5
        "    return g();", // 6
        "  } catch {", // 7
        "  }", // 8
        "}", // 9
        "", // 10
      ].join("\n"),
    });
    try {
      const res = scanTreeErrorSignals(dir);
      assert.equal(res.ok, true);
      if (!res.ok) return;
      assert.deepEqual(
        res.findings.map(key),
        ["catch-empty@drift.ts:7"],
        "the finding's line must be the actual catch line, not the masked drift",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("R3: a neutral return adjacent to an unimplemented marker is reported; the SAME return without the marker is not", () => {
    const dir = fixtureTree({
      "unimplemented.ts": [
        "// fixture: the OV-21 adjacency rule (R3).", // 1
        "export function parseConfig(raw: string): string {", // 2
        "  void raw;", // 3
        "  // NOT IMPLEMENTED: wiring lands with the parser.", // 4
        '  return "";', // 5
        "}", // 6
        "", // 7
      ].join("\n"),
    });
    try {
      const withMarker = scanTreeErrorSignals(dir);
      assert.equal(withMarker.ok, true);
      if (!withMarker.ok) return;
      assert.deepEqual(
        withMarker.findings.map(key),
        ["neutral-return-unimplemented@unimplemented.ts:5"],
        "the marked neutral return must be reported once",
      );
      // Adjacency control: the same return with the marker gone ⇒ zero findings.
      // (This is the false-positive class the marker window exists to avoid.)
      writeFileSync(
        join(dir, "unimplemented.ts"),
        [
          "// fixture: the same return, marker removed (adjacency control).",
          "export function parseConfig(raw: string): string {",
          "  void raw;",
          '  return "";',
          "}",
          "",
        ].join("\n"),
        "utf8",
      );
      const withoutMarker = scanTreeErrorSignals(dir);
      assert.equal(withoutMarker.ok, true);
      if (!withoutMarker.ok) return;
      assert.deepEqual(
        withoutMarker.findings,
        [],
        "a neutral return with NO unimplemented marker must not be reported (adjacency control)",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("R2 allowlist is keyword-aware: `throwaway()`/`rethrow(e)` do not mask a swallow; a real `throw` does", () => {
    // The old substring check (`body.includes("throw")`) treated an identifier
    // containing "throw" as loud, so these two swallows were silently missed.
    // The control is a genuine `throw` statement — still clean.
    const dir = fixtureTree({
      "allowlist.ts": [
        "export function a(x: number): number {", // 1
        "  try { return g(x); }", // 2
        "  catch (e) { throwaway(); }", // 3
        "}", // 4
        "export function b(x: number): number {", // 5
        "  try { return g(x); }", // 6
        "  catch (e) { rethrow(e); }", // 7
        "}", // 8
        "export function c(x: number): number {", // 9
        "  try { return g(x); }", // 10
        "  catch (e) { throw e; }", // 11
        "}", // 12
        "", // 13
      ].join("\n"),
    });
    try {
      const res = scanTreeErrorSignals(dir);
      assert.equal(res.ok, true);
      if (!res.ok) return;
      assert.deepEqual(
        res.findings.map(key),
        ["catch-swallowed@allowlist.ts:3", "catch-swallowed@allowlist.ts:7"],
        "an identifier merely containing `throw` must not satisfy the allowlist; the real throw must",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a loud catch (throw + RT_E_ code) is clean — the allowlist is respected", () => {
    const dir = fixtureTree({
      "clean.ts": [
        "// fixture: a loud catch — never a finding (R2's allowlist).",
        "export function parse(raw: string): number {",
        "  try {",
        "    return Number(raw);",
        "  } catch (err) {",
        "    throw new Error(`RT_E_VALIDATION: ${err instanceof Error ? err.message : String(err)}`);",
        "  }",
        "}",
        "",
      ].join("\n"),
    });
    try {
      const res = scanTreeErrorSignals(dir);
      assert.equal(res.ok, true);
      if (!res.ok) return;
      assert.deepEqual(res.findings, [], "a throw/RT_E_ catch clause is not a swallow");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("masking control: a swallow-shaped STRING is data, not a finding", () => {
    const dir = fixtureTree({
      "masked.ts": ['export const DOC = "try { risky(); } catch { /* sample */ }";', ""].join("\n"),
    });
    try {
      const res = scanTreeErrorSignals(dir);
      assert.equal(res.ok, true);
      if (!res.ok) return;
      assert.deepEqual(
        res.findings,
        [],
        "the masked source hides the string literal — no catch clause is ever analyzed from it",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("an absent dir is a coded refusal — never a throw, never a silent empty scan", () => {
    const missing = join(tmpdir(), `rt-errscan-missing-${process.pid}-${Date.now()}`);
    const res = scanTreeErrorSignals(missing);
    assert.equal(res.ok, false, "an unreadable subject must never be ok");
    if (res.ok) return;
    assert.equal(res.code, "RT_E_VALIDATION", "the documented refusal class");
    assert.match(res.error, /not readable/i, "the refusal names the problem");
    assert.equal("findings" in res, false, "a refusal carries no findings array (nothing was scanned)");
  });
});
