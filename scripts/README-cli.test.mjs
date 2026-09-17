import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * TASK-06 (research/multiagent/111_ui_design_research.md §TASK-06) — the CLI
 * contract doc must not out-live the dispatcher it describes.
 *
 * `scripts/README-cli.md` is the agent-facing machine contract: an AI driver is
 * told to trust it end-to-end. Nothing mechanically linked that file to
 * `scripts/rapidtool-cli.mjs`, so the headline verb count drifted (the doc said
 * 33 while the dispatcher had 34 case arms) and the verb list silently omitted
 * `fixtures` (rapidtool-cli.mjs:832) — i.e. a documented-interface claim that no
 * longer matched behaviour on disk (AGENTS.md §Honesty 3, declare-or-strike).
 *
 * This test binds the two sides:
 *   (a) the headline "**N subcommands**" claim == the real count of `case "` arms;
 *   (b) every verb named in the README's verb list has a case arm;
 *   (c) every case arm is named in the README's verb list;
 *   (d) every line that argues FROM `grep -c 'case "'` cites the real count.
 *
 * Failure messages name the offending verb / line, so a drift is self-explaining.
 *
 * House rule (AGENTS.md §Working rules): a scripts-leg test must not depend on the
 * process cwd — both paths are resolved relative to THIS file via import.meta.url,
 * so the suite can be run from anywhere.
 */

const README_PATH = fileURLToPath(new URL("./README-cli.md", import.meta.url));
const CLI_PATH = fileURLToPath(new URL("./rapidtool-cli.mjs", import.meta.url));

const readmeText = readFileSync(README_PATH, "utf8");
const cliText = readFileSync(CLI_PATH, "utf8");

/** The headline claim: `**34 subcommands** (verified on disk: …)`. */
const COUNT_CLAIM_RE = /\*\*(\d+)\s+subcommands\*\*/;

/** A dispatcher arm: `      case "verb": {`. Names are lowercase + hyphens only. */
const CASE_ARM_RE = /\bcase\s+"([a-z][a-z-]*)"/g;

/** Every verb the dispatcher really has, in source order (duplicates preserved). */
function caseArmVerbs(source) {
  const out = [];
  let m;
  CASE_ARM_RE.lastIndex = 0;
  while ((m = CASE_ARM_RE.exec(source)) !== null) out.push(m[1]);
  return out;
}

/**
 * The verbs the README's own command list names. The list starts inside the
 * headline paragraph and ends at its first em-dash (`… \`deepen\` — from brief
 * to verified artifact`). Only inline-code tokens that LOOK like a verb are
 * taken, so prose code spans (`grep -c 'case "'`, `list`/`propose` sub-verbs in
 * later paragraphs, `tree-run` …) cannot inflate the set — the paragraph ends
 * before the lesson/wild families are described.
 */
function readmeListedVerbs(text) {
  const claim = text.match(COUNT_CLAIM_RE);
  if (!claim || claim.index === undefined) return null;
  const afterClaim = text.slice(claim.index);
  const end = afterClaim.indexOf(" \u2014 ");
  const listBlock = end === -1 ? afterClaim.split("\n\n")[0] : afterClaim.slice(0, end);
  const seen = new Set();
  for (const token of listBlock.matchAll(/`([a-z][a-z-]*)`/g)) {
    seen.add(token[1]);
  }
  return seen;
}

const diskVerbs = caseArmVerbs(cliText);
const diskVerbSet = new Set(diskVerbs);
const realCount = diskVerbs.length;

test("TASK-06: the README verb-count claim equals the real `case \"` arm count", () => {
  const claim = readmeText.match(COUNT_CLAIM_RE);
  assert.ok(claim, "README-cli.md must state the verb count as `**N subcommands**`");
  assert.equal(
    Number(claim[1]),
    realCount,
    `README-cli.md claims ${claim[1]} subcommands; rapidtool-cli.mjs has ${realCount} \`case "\` arms`,
  );
});

test("TASK-06: one arm per line — the documented `grep -c 'case \"'` reads the real count", () => {
  // The README quotes `grep -c 'case "' scripts/rapidtool-cli.mjs` as its count
  // source. `grep -c` counts LINES; the arm count counts occurrences. They agree
  // only while each arm sits on its own line — assert that invariant so the
  // quoted command keeps meaning what the doc says it means.
  const armLines = cliText.split(/\r?\n/).filter((line) => line.includes('case "')).length;
  assert.equal(
    armLines,
    realCount,
    `\`grep -c 'case "'\` reads ${armLines}; ${realCount} arms exist (${realCount - armLines} line(s) hold more than one)`,
  );
});

test("TASK-06: every verb in the README command list has a case arm", () => {
  const listed = readmeListedVerbs(readmeText);
  assert.ok(listed, "README-cli.md must carry the verb list next to the count claim");
  assert.ok(listed.size > 0, "the README verb list parsed empty — the list format changed");
  const missing = [...listed].filter((v) => !diskVerbSet.has(v));
  assert.deepEqual(
    missing,
    [],
    `README lists verb(s) with no case arm in rapidtool-cli.mjs: ${missing.join(", ")}`,
  );
});

test("TASK-06: every case arm is documented in the README command list", () => {
  const listed = readmeListedVerbs(readmeText);
  assert.ok(listed, "README-cli.md must carry the verb list next to the count claim");
  const undocumented = diskVerbs.filter((v) => !listed.has(v));
  assert.deepEqual(
    undocumented,
    [],
    `rapidtool-cli.mjs dispatches verb(s) the README never names: ${[...new Set(undocumented)].join(", ")}`,
  );
});

test("TASK-06: no README line argues from a stale `grep -c 'case \"'` count", () => {
  // Any line quoting the count command must cite the real number — a stale
  // parenthetical is exactly how "33, not 34" out-lived the 34th arm. Verb
  // counts are two digits, so every 1–2 digit number on such a line is checked.
  const lines = readmeText.split(/\r?\n/);
  const checked = [];
  lines.forEach((line, i) => {
    if (!line.includes("grep -c 'case \"'")) return;
    checked.push(i + 1);
    const numbers = [...line.matchAll(/\b\d{1,2}\b/g)].map((m) => Number(m[0]));
    assert.ok(
      numbers.includes(realCount),
      `README-cli.md:${i + 1} quotes \`grep -c 'case "'\` without citing the real count ${realCount}: ${line.trim()}`,
    );
    for (const n of numbers) {
      assert.equal(
        n,
        realCount,
        `README-cli.md:${i + 1} argues from a stale verb count (${n}): ${line.trim()}`,
      );
    }
  });
  assert.ok(checked.length >= 1, "the count command is quoted nowhere in README-cli.md");
});
