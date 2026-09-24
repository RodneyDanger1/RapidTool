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

/**
 * W7-L3 (re-landed by W8-L3, fixes/216s §5): extract ONE dispatcher arm's
 * source — `case "<verb>": { … }` — so a contract test can assert on the
 * implementation the README describes (the doc binds to the arm, not to the
 * whole 2200-line file, so a match elsewhere cannot fake it).
 *
 * Brace-depth scan from the arm's opening `{` to its matching `}`. Arm bodies
 * keep their braces balanced inside strings/comments too (the file's style),
 * so the scan needs no tokenizer; a missing arm returns null and the caller's
 * `assert.ok(arm, …)` names the gap.
 */
function verbArmSource(src, verb) {
  const marker = `case "${verb}"`;
  const at = src.indexOf(marker);
  if (at === -1) return null;
  const open = src.indexOf("{", at);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(at, i + 1);
    }
  }
  return null;
}

test("W7-L3: the `edit` arm exists, reads the documented dry-run/write flags", () => {
  const arm = verbArmSource(cliText, "edit");
  assert.ok(arm, 'rapidtool-cli.mjs has no `case "edit"` arm — the README documents one');
  assert.match(arm, /flag\(args,\s*"write"\)/, "the edit arm must read the documented --write flag (dry-run is the default)");
  assert.match(arm, /dry-run/i, "the edit arm must name its dry-run default");
});

test("W7-L3: the `edit` write path reuses the str_replace primitive + the ONE policy seam", () => {
  const arm = verbArmSource(cliText, "edit");
  assert.ok(arm, 'rapidtool-cli.mjs has no `case "edit"` arm');
  assert.match(arm, /applyStrReplace/, "the edit arm must use the T-107.1 str_replace primitive (src/lib/patch.ts)");
  assert.match(arm, /evaluatePolicy\(\s*"repair\.apply"/, 'the edit write path must consult evaluatePolicy("repair.apply", `tree:<dir>`)');
  assert.match(arm, /decidedVia/, "the edit write path must record the W6 decidedVia provenance shape");
});

test("W7-L3: the README documents the `edit` verb's dry-run default + --write flag", () => {
  assert.match(readmeText, /^## Edit \(`edit`\)/m, "README-cli.md must carry a `## Edit (`edit`)` section");
  assert.match(readmeText, /--write/, "the edit section must document the --write flag");
  assert.match(readmeText, /dry-run/i, "the edit section must state the dry-run default");
  assert.match(readmeText, /repair\.apply/, "the edit section must name the policy action its write is routed through");
});

/**
 * W14-L2 (TA-3): the failure payload's USAGE object must describe every dispatched
 * verb — and nothing else. `diagnose` was dispatched with no USAGE key for waves
 * (the 35-vs-34 drift); this binds the two sides so that class of drift cannot
 * come back silently. The count is READ from the file, never pinned (a future
 * verb must keep USAGE in parity, not match a frozen number).
 */
function usageCommandKeys(source) {
  const start = source.indexOf("const USAGE = {");
  if (start === -1) return null;
  const block = source.slice(source.indexOf("commands: {", start));
  const keys = [];
  for (const line of block.split(/\r?\n/)) {
    if (/^  \}/.test(line)) break; // end of the commands object
    const m = line.match(/^    "?([a-z][a-z-]*)"?: /);
    if (m) keys.push(m[1]);
  }
  return keys;
}

test("W14-L2: every `case \"` arm has a USAGE.commands key (and vice versa)", () => {
  const keys = usageCommandKeys(cliText);
  assert.ok(keys, "rapidtool-cli.mjs must carry the `const USAGE = { … commands: { … } }` object");
  const keySet = new Set(keys);
  const missingFromUsage = [...diskVerbSet].filter((v) => !keySet.has(v));
  assert.deepEqual(
    missingFromUsage,
    [],
    `rapidtool-cli.mjs dispatches verb(s) with no USAGE key (the refusal payload would omit them): ${missingFromUsage.join(", ")}`,
  );
  const undocumented = keys.filter((k) => !diskVerbSet.has(k));
  assert.deepEqual(
    undocumented,
    [],
    `USAGE names verb(s) the dispatcher does not have: ${undocumented.join(", ")}`,
  );
  assert.equal(keys.length, realCount, `USAGE has ${keys.length} keys; the dispatcher has ${realCount} arms`);
});

test("W14-L2 (OV-15): the emit arm reads `--red-tree` and passes the policy to emitProject", () => {
  const arm = verbArmSource(cliText, "emit");
  assert.ok(arm, 'rapidtool-cli.mjs has no `case "emit"` arm');
  assert.match(arm, /args\["red-tree"\]/, "the emit arm must read the documented --red-tree flag");
  assert.match(arm, /"refuse"/, "the emit arm must accept the default `refuse` policy");
  assert.match(arm, /"banner"/, "the emit arm must accept the `banner` policy (the refusal message's own advice)");
  assert.match(arm, /redTree/, "the emit arm must pass a redTree policy through to emitProject");
});

test("W14-L2 (OV-15): README-cli.md documents emit's `--red-tree` policy", () => {
  assert.match(readmeText, /--red-tree/, "README-cli.md must document the emit --red-tree flag");
  assert.match(readmeText, /redTreeBanner/, "the emit section must name the envelope/README banner stamp");
});
