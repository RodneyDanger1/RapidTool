// ---------------------------------------------------------------------------
// typed-failures.test.ts — RT_E inventory guard (99 §6.1 · fixes/102 §RT_E).
//
// Keeps the "bare {ok:false}" class dead: every `ok: false` literal inside
// the AI-interface seam files must carry a `code:` before its enclosing
// object literal closes. Comment/string/template/regex content is masked via
// maskNonCode (algo-tools.ts — the same lexing the complexity heuristic
// uses), so crew prompt prose that merely LOOKS like `ok:false` can never
// trip the guard, and any seam that ships a failure envelope without a
// machine-readable code fails here with file:line — permanently.
//
// Seam scope (P-C3 lane): algo-tools.ts (whole file), chat.server.ts (whole
// file), crew.server.ts SEARCH SEAM ONLY (the SearchOutcome section — the
// orchestration loop's CrewRunResult failures are the loop lane's region).
//
// OPEN SEAM (registered, not yet closed — sibling lane): report-intake.ts
// `ValidateReportResult` union must gain `code: "RT_E_REPORT_INVALID"` on
// every validation failure (99 §6), owned by P-B3 (fixes/101 lane). The day
// that lands, add `{ file: "report-intake.ts" }` to SEAMS below and drop the
// note in fixes/102 §RT_E handoff.
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { maskNonCode } from "./algo-tools.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

type Seam = {
  file: string;
  /** Region start: first line matching this regex (whole-file when absent). */
  from?: RegExp;
  /** Region end (exclusive): first line AFTER `from` matching this regex. */
  to?: RegExp;
};

const SEAMS: Seam[] = [
  { file: "algo-tools.ts" },
  { file: "chat.server.ts" },
  {
    file: "crew.server.ts",
    from: /^type SearchOutcome =/,
    to: /^\/\/ ---/,
  },
];

const OK_FALSE = /ok\s*:\s*false/;
/** A code-carrying field in the literal: `code: X`, optional `code?: X`, or
 *  the shorthand `{ ok: false, reason, error, code }`. `\b` keeps encode/decoder
 *  out. */
const CODE = /(code\??\s*:|\bcode\b)/;
/** A line that closes the object literal the ok:false opened (`};`, `},`, bare `}`). */
const CLOSES = /^\s*\}[\s,;]*\s*$/;
/** Max lines to scan between an ok:false and its code (covers doc comments). */
const WINDOW = 8;

/** 1-based line numbers (within the seam region) of bare ok:false literals. */
function bareFailures(src: string): number[] {
  const masked = maskNonCode(src);
  const lines = masked.split("\n");
  const out: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!OK_FALSE.test(lines[i])) continue;
    if (CODE.test(lines[i])) continue; // same-line code — closed
    let found = false;
    for (let j = i + 1; j < Math.min(i + 1 + WINDOW, lines.length); j++) {
      const line = lines[j];
      if (line.includes("}") && CLOSES.test(line)) break; // literal closed bare
      if (CODE.test(line)) {
        found = true;
        break;
      }
    }
    if (!found) out.push(i + 1);
  }
  return out;
}

describe("typed-failure inventory (99 §6.1)", () => {
  for (const seam of SEAMS) {
    const label = `${seam.file}${seam.from ? " (search-seam region)" : ""}`;
    it(`every ok:false in ${label} carries a code`, () => {
      const raw = readFileSync(join(HERE, seam.file), "utf8");
      const lines = raw.split("\n");
      let start = 0;
      let end = lines.length;
      if (seam.from) {
        const s = lines.findIndex((l) => seam.from!.test(l));
        assert.ok(s >= 0, `${seam.file}: region start marker not found`);
        start = s;
        if (seam.to) {
          const e = lines.slice(start + 1).findIndex((l) => seam.to!.test(l));
          assert.ok(e >= 0, `${seam.file}: region end marker not found`);
          end = start + 1 + e;
        }
      }
      const bare = bareFailures(lines.slice(start, end).join("\n"));
      assert.deepEqual(
        bare,
        [],
        `${seam.file}: bare ok:false literal${bare.length === 1 ? "" : "s"} at region line${
          bare.length === 1 ? "" : "s"
        } ${JSON.stringify(bare)} — every failure envelope must carry a code (errors.ts)`,
      );
    });
  }

  it("guard never silently no-ops: each seam region contains at least one ok:false literal", () => {
    for (const seam of SEAMS) {
      const raw = readFileSync(join(HERE, seam.file), "utf8");
      const lines = raw.split("\n");
      let start = 0;
      let end = lines.length;
      if (seam.from) {
        const s = lines.findIndex((l) => seam.from!.test(l));
        assert.ok(s >= 0, `${seam.file}: region start marker not found`);
        start = s;
        if (seam.to) {
          const e = lines.slice(start + 1).findIndex((l) => seam.to!.test(l));
          assert.ok(e >= 0, `${seam.file}: region end marker not found`);
          end = start + 1 + e;
        }
      }
      const masked = maskNonCode(lines.slice(start, end).join("\n"));
      const count = masked.split("\n").filter((l) => OK_FALSE.test(l)).length;
      assert.ok(count >= 1, `${seam.file}: expected ≥1 ok:false literal in the seam region`);
    }
  });
});
