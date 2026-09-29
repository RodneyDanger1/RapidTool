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
// Legs 1–4 are source-text only — the CLI is never imported, the bytes are
// the artifact a reviewer diffs. Leg 5 (309/A1) is BEHAVIORAL by design: it
// spawns the CLI as a child process (still never imported) to pin the wild-arm
// fuzz shape from 308 M3:
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
//   4. (G8/OPS-13) every quoted RT_E_* literal in the CLI is registered in
//      ERROR_CODE_DOC.
//   5. (309/A1, behavioral spawn) the wild fuzz shape refuses CODED.
//   6-8. (310/B1 · M6-05/06, source + TWO behavioral spawns) the Node global
//      nets: no bare `main();`, ONE `exitInternalError` seam (stack → stderr,
//      respond() envelope at exit 4), and both process.on nets — proven with
//      REAL injected faults (`--import` shim gated on the CLI's own listeners,
//      no startup race; a deadline fallback still faults a REGRESSED CLI so
//      the pin goes red loudly instead of hanging).
//   9. (312 · C2/D2, behavioral spawn) the `wild` verb's onEvent hop: a real
//      keyless `wild --start` must land wild.step_* rows in the NDJSON log
//      while the success envelope stays the plain shape (the hop is
//      emission-side only — it must never alter envelope or project bytes).
//
// House rules honored: cwd-independent (paths via import.meta.url — a
// scripts-leg test must not depend on process cwd); failure messages name the
// offending line + code so a drift is self-explaining.
// Run: node --test scripts/cli-exit-taxonomy.test.mjs
// ---------------------------------------------------------------------------
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

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

// ---------------------------------------------------------------------------
// Leg 4 (G8/OPS-13, W42): envelope-code registry membership. The CLI's
// `ensureErrorCodes` doc-guard only lets a classifier result ride an envelope
// when it is shape-valid AND registered in `ERROR_CODE_DOC`; this leg pins the
// STATIC side — every quoted `RT_E_*` literal in the CLI must be a registered
// code, so a literal can never drift out of `src/lib/errors.ts` unnoticed.
// ---------------------------------------------------------------------------
const ERRORS_PATH = fileURLToPath(new URL("../src/lib/errors.ts", import.meta.url));

test("envelope codes — every RT_E_* literal in the CLI is registered in ERROR_CODE_DOC", () => {
  const errorsText = readFileSync(ERRORS_PATH, "utf8");
  const docBlock = errorsText.match(/export const ERROR_CODE_DOC[^=]*=\s*\{([\s\S]*?)\n\};/);
  assert.ok(
    docBlock,
    "ERROR_CODE_DOC block not found in src/lib/errors.ts — re-derive this guard against the new shape",
  );
  const docCodes = new Set(
    [...docBlock[1].matchAll(/^\s*(RT_E_[A-Z0-9_]+):/gm)].map((m) => m[1]),
  );
  // Vacuity floor: 34 registered codes at the W42 write. A shrunken extraction
  // means the block's shape moved — re-derive instead of reading a green.
  assert.ok(
    docCodes.size >= 30,
    `ERROR_CODE_DOC extraction found only ${docCodes.size} codes — the scan has gone vacuous; re-derive this guard.`,
  );
  // Widened scan (A-66): every quoted RT_E_* literal — `code: "…"` fields AND
  // `payload.code = "…"` assignments; no single-quoted/backticked forms exist
  // today, both are scanned so a future one cannot dodge the guard.
  const literals = [
    ...new Set([...cliText.matchAll(/["'`](RT_E_[A-Z0-9_]*)["'`]/g)].map((m) => m[1])),
  ];
  // Vacuity floor: 14 distinct literals at the W42 write.
  assert.ok(
    literals.length >= 10,
    `found only ${literals.length} RT_E_* literals in the CLI — the scan has gone vacuous (quoting changed?). Re-derive this guard.`,
  );
  const unregistered = literals.filter((c) => !docCodes.has(c));
  assert.deepEqual(
    unregistered,
    [],
    `CLI literals outside ERROR_CODE_DOC (${ERRORS_PATH}): ${unregistered.join(", ")} — register the code in src/lib/errors.ts's ERROR_CODES+ERROR_CODE_DOC or fix the literal; envelopes must never carry unregistered codes (OPS-13).`,
  );
});

// ---------------------------------------------------------------------------
// Leg 5 (309/A1, BEHAVIORAL — a spawned child; the CLI is still never
// imported). The 308 M3 fuzz-lite found the ONE verb whose read-only controls
// bypassed the E-25 makeLoader contract: the `wild` arm called
// `h.loadProject(path, …)` RAW, so the fuzz's four shapes (missing file /
// directory / wrong-shape JSON / missing file + `--out`) all crashed with a
// Node STACK at exit 4 instead of a coded refusal. The guard
// (rapidtool-cli.mjs ~:3360, same classify contract) is pinned at the
// strongest level this file can offer: a real process, the exact fuzz shape
// `wild --project nope.json` → exit 1 + `RT_E_PROJECT_MISSING`, no stack.
// ---------------------------------------------------------------------------
test("wild fuzz shape — `wild --project <missing>.json` refuses CODED (exit 1), never STACKs", () => {
  // Throwaway temp cwd + keyless/seatless env (AGENTS.md scripts-leg cwd rule;
  // same scrub set as rapidtool-cli-edit.test.mjs). The child resolves every
  // path via import.meta.url — this test never depends on the repo cwd.
  const cwd = mkdtempSync(join(tmpdir(), "rapidtool-cli-taxonomy-"));
  const env = { ...process.env };
  for (const key of ["DEEPSEEK_API_KEY", "RT_HUMAN_SEAT_TOKEN", "RAPIDTOOL_ACTOR", "RAPIDTOOL_LOG_DIR"]) {
    delete env[key];
  }
  const missing = join(cwd, "nope.json"); // never created — the fuzz's `proj-nowhere`
  const res = spawnSync(process.execPath, ["--experimental-strip-types", CLI_PATH, "wild", "--project", missing], {
    cwd,
    env,
    encoding: "utf8",
    timeout: 120_000,
  });
  assert.equal(res.error, undefined, `spawn failed: ${String(res.error)}`);
  const stderr = res.stderr ?? "";
  assert.ok(
    !/(^|\n)\s+at\s/.test(stderr),
    `wild must never print a Node stack (the 308 M3 fuzz's STACK(exit4) class — the raw h.loadProject crash resurfaced):\n${stderr}`,
  );
  assert.equal(
    res.status,
    1,
    `missing project → exit 1 (RT_E_PROJECT_MISSING is usage-class); exit 4 IS the regressed crash.\nstdout: ${res.stdout}\nstderr: ${stderr}`,
  );
  let json = null;
  try {
    json = JSON.parse(res.stdout);
  } catch {
    /* surfaced by the assert below */
  }
  assert.ok(json, `wild must print exactly one JSON envelope.\nstdout: ${res.stdout}\nstderr: ${stderr}`);
  assert.equal(json.ok, false, "a missing project is a refusal envelope");
  assert.equal(
    json.code,
    "RT_E_PROJECT_MISSING",
    "a read ENOENT must classify as RT_E_PROJECT_MISSING (the makeLoader/errCode contract) — a generic code (or none) means the guard drifted",
  );
  assert.equal(json.exit_code, res.status, "the envelope's exit_code must equal the process exit");
});

// ---------------------------------------------------------------------------
// Legs 6-8 (M6-05/M6-06, fixes/310 · B1) — the Node-side global nets. Leg 6 is
// source-text (the CLI's bytes are the artifact a reviewer diffs); legs 7/8
// are BEHAVIORAL spawns with REAL injected faults. The 308 map6 defects: a
// bare `main();` (a rejection from the awaits ABOVE main()'s internal
// try/catch escaped with no envelope) and no process-level
// unhandledRejection/uncaughtException handler on any Node path. The fix: ONE
// `exitInternalError` seam (stack → stderr; the SAME respond() envelope the
// internal catch emits: ok:false + RT_E_INTERNAL + exit 4) + main().catch +
// both process nets.
// ---------------------------------------------------------------------------
test("M6-05/06 (310 · B1) — no bare `main();`; both Node nets route through ONE exitInternalError seam", () => {
  const bare = cliText.match(/(^|\n)\s*main\(\);\s*(\n|$)/);
  assert.equal(
    bare,
    null,
    "a bare `main();` is back: a rejection from the awaits ABOVE main()'s internal try/catch " +
      "would escape with no envelope (308 M6-05). Route it through main().catch(exitInternalError).",
  );
  assert.match(cliText, /main\(\)\.catch\(exitInternalError\)/, "main() must be .catch()ed through the ONE exitInternalError seam");
  assert.equal(countCodeOccurrences(/process\.on\("unhandledRejection"/g), 1, "exactly ONE unhandledRejection net (M6-06)");
  assert.equal(countCodeOccurrences(/process\.on\("uncaughtException"/g), 1, "exactly ONE uncaughtException net (M6-06)");
  assert.match(
    cliText,
    /process\.on\("unhandledRejection",\s*\(reason\)\s*=>\s*exitInternalError\(reason\)\)/,
    "the unhandledRejection net must route through exitInternalError (one shape, not a second ad-hoc envelope)",
  );
  assert.match(
    cliText,
    /process\.on\("uncaughtException",\s*\(err\)\s*=>\s*exitInternalError\(err\)\)/,
    "the uncaughtException net must route through exitInternalError",
  );
  const seam = cliText.match(/function exitInternalError\(err\) \{[\s\S]*?\n\}/);
  assert.ok(seam, "exitInternalError seam not found in rapidtool-cli.mjs — re-derive this guard");
  assert.match(seam[0], /console\.error\(stack\)/, "the seam must print the stack to stderr (stdout stays exactly one JSON object)");
  assert.match(
    seam[0],
    /respond\(\{ ok: false, error: message, \.\.\.errCode\(err, "RT_E_INTERNAL"\) \}, 4\)/,
    "the seam must emit the SAME respond() envelope as main()'s internal catch (ok:false + RT_E_INTERNAL + exit 4)",
  );
});

/**
 * Legs 7/8 harness: spawn the real CLI with a fault-injecting `--import` shim.
 * The shim polls for the CLI's OWN listeners before injecting (no startup
 * race); a 20s deadline fallback still faults a REGRESSED CLI — it then dies
 * bare and the assertions go red loudly instead of hanging. The child runs a
 * real `ingest --report -` against a fixture project with stdin held open, so
 * it parks (alive) while the shim injects.
 */
async function spawnWithInjectedFault({ name, ready, inject }) {
  const cwd = mkdtempSync(join(tmpdir(), `rapidtool-cli-nets-${name}-`));
  const env = { ...process.env }; // same scrub set as rapidtool-cli-edit.test.mjs
  for (const key of ["DEEPSEEK_API_KEY", "RT_HUMAN_SEAT_TOKEN", "RAPIDTOOL_ACTOR", "RAPIDTOOL_LOG_DIR"]) {
    delete env[key];
  }
  let child = null;
  try {
    const proj = join(cwd, "pin-project.json");
    const created = spawnSync(
      process.execPath,
      ["--experimental-strip-types", CLI_PATH, "create", "--brief", "B1 net pin fixture project", "--out", proj],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(created.status, 0, `fixture create failed.\nstdout: ${created.stdout}\nstderr: ${created.stderr}`);
    const shim = join(cwd, "b1-fault-inject.mjs");
    writeFileSync(
      shim,
      [
        "// B1 (310) fault shim — inject only once the CLI's own nets are live.",
        "const deadline = Date.now() + 20_000;",
        "const gate = setInterval(() => {",
        `  const ready = ${ready} && process.listenerCount("SIGTERM") > 0;`,
        "  if (ready || Date.now() > deadline) {",
        "    clearInterval(gate);",
        `    ${inject}`,
        "  }",
        "}, 5);",
        "",
      ].join("\n"),
    );
    child = spawn(
      process.execPath,
      ["--import", pathToFileURL(shim).href, "--experimental-strip-types", CLI_PATH, "ingest", "--project", proj, "--report", "-"],
      { cwd, env, stdio: ["pipe", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d;
    });
    child.stderr.on("data", (d) => {
      stderr += d;
    });
    const exit = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          /* ignore */
        }
        reject(new Error(`timed out waiting for the CLI to exit (${name}).\nstdout: ${stdout}\nstderr: ${stderr}`));
      }, 120_000);
      child.on("close", (code, signal) => {
        clearTimeout(timer);
        resolve({ code, signal });
      });
    });
    return { exit, stdout, stderr };
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) {
      try {
        child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
    }
    rmSync(cwd, { recursive: true, force: true });
  }
}

/** The M6-05/06 net contract: exit 4 + one JSON envelope + the fault on stderr. */
function assertNetEnvelope({ exit, stdout, stderr }, marker) {
  assert.equal(
    exit.code,
    4,
    `an injected fault must exit 4 (RT_E_INTERNAL class), not crash bare — got code=${exit.code} signal=${exit.signal}.\n` +
      `stdout: ${stdout}\nstderr: ${stderr}`,
  );
  let json = null;
  try {
    json = JSON.parse(stdout);
  } catch {
    /* surfaced below */
  }
  assert.ok(json, `the net must print exactly one JSON envelope.\nstdout: ${stdout}\nstderr: ${stderr}`);
  assert.equal(json.ok, false, "the envelope is a refusal");
  assert.equal(json.code, "RT_E_INTERNAL", "an escaped internal fault classifies as RT_E_INTERNAL");
  assert.equal(json.exit_code, 4, "the envelope's exit_code mirrors the process exit");
  assert.match(stderr, new RegExp(marker), "the fault's stack/message must land on stderr (stdout stays one JSON object)");
}

test("M6-05/06 (310 · B1) — an injected unhandled rejection exits CODED (exit 4, one JSON envelope)", async () => {
  const out = await spawnWithInjectedFault({
    name: "rejection",
    ready: `process.listenerCount("unhandledRejection") > 0`,
    inject: `Promise.reject(new Error("B1 pin: injected unhandled rejection"));`,
  });
  assertNetEnvelope(out, "B1 pin: injected unhandled rejection");
});

test("M6-05/06 (310 · B1) — an injected uncaught exception exits CODED (exit 4, one JSON envelope)", async () => {
  const out = await spawnWithInjectedFault({
    name: "exception",
    ready: `process.listenerCount("uncaughtException") > 0`,
    inject: `setImmediate(() => { throw new Error("B1 pin: injected uncaught exception"); });`,
  });
  assertNetEnvelope(out, "B1 pin: injected uncaught exception");
});

// ---------------------------------------------------------------------------
// Leg 9 (312 · C2/D2 — the B-02 CLI hop, BEHAVIORAL spawn). The `wild` verb's
// `opts.onEvent → cliLogEvent` hop is the only production path carrying the
// headless wild.step_* telemetry into the NDJSON log — before 312 the seam
// existed but no caller passed a sink, so the rows never landed. This leg
// spawns a REAL keyless `wild --start` (deterministic floor: no key ⇒ no
// network, the loop runs a few real steps) and reads the rows back from
// resolveLogDir(project) = <project dir>/.rapidtool/logs. The envelope must
// stay the plain success shape — the hop is emission-side only.
// ---------------------------------------------------------------------------
test("312 B-02 — the wild verb's onEvent hop lands wild.step_* rows in the NDJSON log; envelope unchanged", () => {
  const cwd = mkdtempSync(join(tmpdir(), "rapidtool-cli-wildhop-"));
  const env = { ...process.env };
  for (const key of ["DEEPSEEK_API_KEY", "RT_HUMAN_SEAT_TOKEN", "RAPIDTOOL_ACTOR", "RAPIDTOOL_LOG_DIR"]) {
    delete env[key];
  }
  try {
    const proj = join(cwd, "wildhop.json");
    const created = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        CLI_PATH,
        "create",
        "--brief",
        "Build a field-service dispatch board for HVAC: jobs, techs, parts, same-day reroutes.",
        "--name",
        "WildHop",
        "--out",
        proj,
      ],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(created.status, 0, `create must exit 0.\nstdout: ${created.stdout}\nstderr: ${created.stderr}`);

    // Keyless --start: the classifier cannot self-approve, so the bounded loop
    // runs REAL steps (deterministic floor — no key ⇒ no network).
    const res = spawnSync(
      process.execPath,
      ["--experimental-strip-types", CLI_PATH, "wild", "--project", proj, "--start", "--steps", "2"],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(res.error, undefined, `spawn failed: ${String(res.error)}`);
    assert.equal(res.status, 0, `wild --start must exit 0.\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
    const json = JSON.parse(res.stdout);
    assert.equal(json.ok, true);
    assert.equal(json.action, "start");
    assert.equal(json.exit_code, res.status, "the envelope's exit_code must equal the process exit");
    assert.ok(typeof json.steps === "number" && json.steps >= 1, "the envelope still reports the executed step count");
    assert.ok(!("error" in json), "a success envelope never carries `error` (185-H1) — telemetry must not alter the envelope");

    // The hop's rows: resolveLogDir(project) = <project dir>/.rapidtool/logs.
    const logDir = join(cwd, ".rapidtool", "logs");
    assert.ok(
      existsSync(logDir),
      `the NDJSON log dir must exist at ${logDir} — did the wild verb lose its ensureRtAppender()/cliLogEvent hop?`,
    );
    const logText = readdirSync(logDir)
      .filter((f) => f.endsWith(".ndjson"))
      .map((f) => readFileSync(join(logDir, f), "utf8"))
      .join("\n");
    const rows = logText
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    const stepRows = rows.filter((r) => typeof r.event === "string" && r.event.startsWith("wild.step"));
    assert.ok(
      stepRows.length >= 2,
      `expected wild.step_* telemetry rows in the NDJSON log, got ${stepRows.length} ` +
        `(events: ${rows.map((r) => r.event).join(", ")})`,
    );
    assert.ok(
      stepRows.some((r) => r.event === "wild.step_start"),
      "wild.step_start must reach the NDJSON log via the onEvent hop",
    );
    assert.ok(
      stepRows.some((r) => r.event === "wild.step_ok" || r.event === "wild.step_paused" || r.event === "wild.step_error"),
      "the step's terminal row must reach the NDJSON log (the hop must not drop terminal emits)",
    );
    assert.ok(
      stepRows.every((r) => r.host === "cli" && r.scope === "wild-step"),
      "every wild.step_* row must be a CLI-stamped wild-step row (makeCliRow)",
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

