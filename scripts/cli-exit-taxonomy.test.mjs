// ---------------------------------------------------------------------------
// cli-exit-taxonomy.test.mjs — the exit-taxonomy guard the CLI's OWN comments
// cite as if it existed (W36 · N5 · OPS-3 closes the "cited but absent" gap).
//
// Cited by:
//   · `rapidtool-cli.mjs` approve block (R5-f12): "the same-env-var-both-sides
//     degeneracy this replaces is statically forbidden by
//     scripts/cli-exit-taxonomy.test.mjs"
//   · `rapidtool-cli.mjs` edit-seam block (R5-f12): same promise.
//
// Spec: research/multiagent/thoroughanalysis.md §R5-f03 (A2-f03 CONFIRMED +
// WIDENED) — "Mechanical guard (fixture; new file)": for every
// `errCode(err, "RT_E_INTERNAL")` occurrence in the CLI, the nearest following
// `}, <N>)` respond exit within ~400 chars must be 4; assert 0 offenders;
// also assert README-cli.md still carries the "Exit 4 = backend or internal
// runtime failure" sentence. The 14-verb 1→4 landing is live (W29 LANE H);
// this guard keeps the class from drifting back — it was RED before the fix,
// it pins the fix now.
//
// Legs (all source-text only — the CLI is never imported, the bytes are the
// artifact a reviewer diffs):
//   1. exit taxonomy BY CODE CLASS: every `errCode(err, "<CODE>")` site must
//      exit the class's documented `typical exit_code` from README-cli.md's
//      error table — RT_E_INTERNAL → 4, usage-class codes → 1. An unmapped
//      code fails loudly (declare its documented exit, never guess).
//   2. README-cli.md keeps the §Agent contract exit-4 sentence.
//   3. The two-channel seat: the same-env-var-both-sides degeneracy stays
//      statically forbidden — exactly ONE `process.env.RT_HUMAN_SEAT_TOKEN`
//      read in the CLI (the expected side), the presented side typed at the
//      TTY prompt, every `--i-am-human` claim routed through the ONE
//      `humanSeatClaim` seam (with its non-TTY refusal).
//
// House rules honored: cwd-independent (paths via import.meta.url — a
// scripts-leg test must not depend on process cwd); failure messages name the
// offending line + code so a drift is self-explaining.
// Run: node --test scripts/cli-exit-taxonomy.test.mjs
// ---------------------------------------------------------------------------
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const CLI_PATH = fileURLToPath(new URL("./rapidtool-cli.mjs", import.meta.url));
const README_PATH = fileURLToPath(new URL("./README-cli.md", import.meta.url));
const cliText = readFileSync(CLI_PATH, "utf8");
const readmeText = readFileSync(README_PATH, "utf8");

/**
 * The documented exit class per RT_E code — README-cli.md's error table
 * ("typical exit_code" column; §Agent contract owns the taxonomy). Only codes
 * that actually appear in an `errCode(err, "<CODE>")` call belong here; a NEW
 * code at such a site must be added WITH its documented exit, never guessed.
 */
const EXIT_BY_CODE = {
  RT_E_INTERNAL: 4, // README-cli.md error table: "Unexpected internal failure … | 4"
  RT_E_VALIDATION: 1, // "Input or model output failed validation … | 1"
  RT_E_PROJECT_MISSING: 1, // "The referenced project … does not exist … | 1"
  RT_E_REPORT_INVALID: 1, // "An ingested agent report failed shape validation … | 1"
};

/** 1-based line number of a character index. */
function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

/**
 * Occurrences of `pattern` on CODE lines only (`//`-led comment lines are
 * skipped): the W29 header comment above `humanSeatClaim` quotes the old
 * defect verbatim — `“humanSeatToken` and `expectedHumanSeatToken` from the
 * SAME `process.env.RT_HUMAN_SEAT_TOKEN`” — so a whole-file count would read
 * the prose, not the reads. The invariant is about CODE.
 */
function countCodeOccurrences(pattern) {
  let n = 0;
  for (const line of cliText.split(/\r?\n/)) {
    if (/^\s*\/\//.test(line)) continue;
    n += (line.match(pattern) ?? []).length;
  }
  return n;
}

/** `errCode(<ident>, "CODE")` call sites with the nearest following `}, <N>)`.
 *  W40 (Q8/R1): widened from `errCode(err, …)` to ANY identifier — `saveErr`-style
 *  sites (:993) were previously unscanned. Widening only; same 28+ sites, 0 offenders. */
function errCodeSites(source) {
  const re = /errCode\(\s*[A-Za-z_$][\w$.]*\s*,\s*"([A-Z0-9_]+)"\s*\)/g;
  const sites = [];
  let m;
  while ((m = re.exec(source)) !== null) {
    const window = source.slice(m.index, m.index + 400);
    const exit = window.match(/\},\s*(\d+)\s*[,)]/);
    sites.push({
      line: lineOf(source, m.index),
      code: m[1],
      exit: exit ? Number(exit[1]) : null,
    });
  }
  return sites;
}

test("exit taxonomy — every errCode(err, <code>) site exits its documented class", () => {
  const sites = errCodeSites(cliText);
  // Vacuity floor: 27 literal-code sites at the W36 write (24 RT_E_INTERNAL +
  // 3 usage-class). If the scan finds ~0, the helper was renamed/rewritten —
  // re-derive the guard deliberately instead of reading a green.
  assert.ok(
    sites.length >= 20,
    `found only ${sites.length} errCode(err, "<CODE>") sites — the scan has gone vacuous ` +
      `(helper renamed?). Re-derive this guard against the new shape.`,
  );
  const offenders = sites
    .filter((s) => {
      const want = EXIT_BY_CODE[s.code];
      if (want === undefined) return true; // unmapped code class — must be declared
      return s.exit !== want;
    })
    .map((s) => {
      const want = EXIT_BY_CODE[s.code];
      const got = s.exit === null ? "no following `}, <N>)` within 400 chars" : String(s.exit);
      const why =
        want === undefined
          ? `unmapped code class — add it to EXIT_BY_CODE with its documented exit from README-cli.md's error table`
          : `exits ${got}, documented class exits ${want}`;
      return `${CLI_PATH.split(/[\\/]/).pop()}:${s.line} (${s.code}) — ${why}`;
    });
  assert.deepEqual(
    offenders,
    [],
    `exit-taxonomy offenders (README-cli.md §Agent contract + error table own the mapping):\n  ${offenders.join("\n  ")}`,
  );
});

test("exit taxonomy — README-cli.md keeps the documented Exit-4 sentence", () => {
  assert.match(
    readmeText,
    /\*\*Exit 4\*\* = backend or internal runtime failure/,
    "README-cli.md §Agent contract must keep the sentence 'Exit 4 = backend or internal runtime failure' " +
      "(the taxonomy this guard pins; strike-or-declare applies to docs too).",
  );
});

test("two-channel seat — the same-env-var-both-sides degeneracy stays statically forbidden", () => {
  // (a) Exactly ONE env read of the seat secret — the expected side. The
  // degeneracy's premise is a SECOND read; any second read re-opens it.
  const envReads = countCodeOccurrences(/process\.env\.RT_HUMAN_SEAT_TOKEN\b/g);
  assert.equal(
    envReads,
    1,
    `expected exactly 1 CODE-level \`process.env.RT_HUMAN_SEAT_TOKEN\` read (the expected side inside humanSeatClaim), found ${envReads}. ` +
      `Two reads from the same env var IS the degeneracy R5-f12 killed ("the env var is non-empty" ⇒ verified human) — keep one read, typed prompt for the other side.`,
  );
  // The bracket form would dodge the dot-form count — ban it outright.
  assert.ok(
    !/process\.env\["RT_HUMAN_SEAT_TOKEN"\]/.test(cliText),
    "the seat secret must be read exactly once, via the dot form at humanSeatClaim's expected side — no `process.env[...]` alternates",
  );
  // (b) The presented side must never be sourced from the environment.
  assert.ok(
    !/humanSeatToken:\s*process\.env/.test(cliText),
    "the PRESENTED seat token (`humanSeatToken:`) must be the typed TTY re-entry, never a process.env read",
  );
  // (c) The one seam: bodies + the non-TTY refusal live inside humanSeatClaim.
  const seamMatch = cliText.match(/async function humanSeatClaim\(cmd\) \{[\s\S]*?\n\}/);
  assert.ok(seamMatch, "humanSeatClaim seam not found in rapidtool-cli.mjs — re-derive this guard");
  const seam = seamMatch[0];
  assert.match(
    seam,
    /process\.stdin\.isTTY !== true/,
    "humanSeatClaim must refuse a non-TTY claim (no second channel exists there — no human row may be minted)",
  );
  assert.match(seam, /not a TTY/, "the non-TTY refusal message must say why (the environment alone cannot furnish a second channel)");
  assert.match(
    seam,
    /humanSeatToken:\s*await promptHumanSeatToken\(\)/,
    "the presented side must be the TYPED TTY prompt value (Channel B)",
  );
  assert.match(
    seam,
    /expectedHumanSeatToken:\s*process\.env\.RT_HUMAN_SEAT_TOKEN/,
    "the expected side must be the env read (Channel A)",
  );
  // (d) Every `--i-am-human` claim routes through the ONE seam: each ternary
  // claim site must be a `humanSeatClaim(` call — counts must agree.
  const claimSites = cliText.match(/flag\(args, "i-am-human"\)\s*\?\s*await humanSeatClaim\(/g) ?? [];
  const seamCalls = cliText.match(/await humanSeatClaim\(/g) ?? [];
  assert.ok(claimSites.length >= 3, `expected >= 3 --i-am-human claim sites (approve / fixtures / edit), found ${claimSites.length}`);
  assert.equal(
    claimSites.length,
    seamCalls.length,
    `claim sites (${claimSites.length}) !== humanSeatClaim( calls (${seamCalls.length}) — a claim bypasses the ONE seat seam`,
  );
});
