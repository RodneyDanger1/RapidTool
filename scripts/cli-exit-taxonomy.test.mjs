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
//  10. (316 · H3/I2, behavioral spawn) the `--agent-seal` pointer refusals:
//      `approve`/`gate` refuse CODED (exit 1) naming the wild door.
//  11. (316 · H7's gap; I3 finisher, behavioral spawn) the fresh-command
//      floor: bare / unknown verb → exit 1 + one `RT_E_VALIDATION` envelope,
//      no stack. (W49 · 335-4 moved `--help` out of the floor — a help request
//      is a SUCCESS now; legs 11b/11c/11d pin the W49 CLI-UX contract:
//      help → exit 0; a usage refusal's remedy names the fix; a non-numeric
//      value on a documented numeric flag is refused.)
//  12. (T8.2 · 314 F5 K2/K5; 311_sd_product §1, behavioral spawn + source) the
//      approve seat discipline: the seat is NEVER guessed — a bare approve
//      (non-TTY) and a non-`autopilot` `--seat` value both refuse CODED
//      (exit 1 + RT_E_VALIDATION + a remedy naming both seat paths), the
//      explicit `--seat autopilot` machine door works non-TTY and stamps its
//      own machine attribution, and the TTY arm's bytes (the K2 silent
//      machine-attribution bug this guard killed) stay on disk.
//  13. (W44 X2 · seeded ticket T / D2 F-2, behavioral spawn) the forceHuman
//      gate's machine door: `approve --seat autopilot` on a forceHuman gate
//      refuses CODED at the verb (exit 1 + RT_E_VALIDATION + the human-door
//      remedy) and decides nothing — never the engine throw's RT_E_INTERNAL /
//      exit 4 wrap (live bytes: live1/03_sealed_approve_autopilot.out).
//  14. (322 · F-1 scripts half + X1's R-A actor seam, behavioral spawn) the
//      reject door's seat discipline: a bare reject (non-TTY) and a non-seat
//      `--seat` value refuse CODED (exit 1 + RT_E_VALIDATION, nothing minted),
//      and `--seat autopilot` stamps its OWN machine actor on `lastGate` + the
//      minted ledger row — a machine reject can never mint `decidedBy:"human"`
//      (the pre-322 `rejectHitl` hardcode; live bytes live1/05_sealed_reject_note.out).
//  15. (fixes/323 FIX-2c · window #4 item 3, behavioral spawn) the exit-2
//      PARK row: a REAL keyless `gate` park (exit 2) stamps its cli.invocation
//      row at level `warn` + `payload.parked:true`, code null — a park is the
//      designed outcome, never level:error (the pre-fix bytes read
//      `level:"error", code:null` and diagnose ranked them unclassified-errors /
//      "not a clean bill of health").
//  16. (W44 A5 · fixes/325_a5_hunt.md B1+B3, source + behavioral spawns) the
//      empty-VALUE path-flag refusals: `--out=` / `--html=` ("" after the `=`)
//      used to pass every `typeof === "string"` read and `resolve("")` melted
//      the write target into the process CWD (pre-fix live bytes: emit/vault
//      exited 0 writing 15/17 files INTO the cwd; packet/create exited 4 with
//      EISDIR/EPERM + a `.tmp` leak). This leg content-anchors all seven
//      guard sites (pathFlagMissing, never `=== true`), spawns the empty
//      spelling for the four repro'd verbs + export/design --html/diagram
//      into fresh melt dirs (exit 1 + RT_E_VALIDATION + "(got an empty
//      value)", nothing written), keeps the R5-f10 valueless bytes pinned,
//      and pins B3: USAGE.reject must name both seats.
//
// House rules honored: cwd-independent (paths via import.meta.url — a
// scripts-leg test must not depend on process cwd); failure messages name the
// offending line + code so a drift is self-explaining.
// Run: node --test scripts/cli-exit-taxonomy.test.mjs
// ---------------------------------------------------------------------------
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

// ---------------------------------------------------------------------------
// Leg 10 (316 · H3, 315 V2 finding #4 — BEHAVIORAL spawn). `--agent-seal` is a
// WILD-RUN concept; `wild --start|--resume --agent-seal` is the ONE door that
// threads it into the wild loop. Before H3, parseArgs absorbed the flag on the
// drive verbs, so `approve --agent-seal` / `gate --agent-seal` were silently
// ignored — a governance flag a caller could believe had applied, when it
// never could. The fix is ONE coded pointer refusal (RT_E_VALIDATION + the
// remedy naming the wild door). This leg spawns the real CLI on both verbs
// and pins the envelope bytes: the refusal fires on the flag alone — BEFORE
// any project load (no `--project` is passed at all) — exits 1, and never
// STACKs. A source-text doc guard keeps README-cli.md's refusal sentence.
// ---------------------------------------------------------------------------
test("316 H3 — `approve`/`gate --agent-seal` refuse CODED with the wild-door pointer (exit 1)", () => {
  assert.ok(
    readmeText.includes("approve/gate/run/resume/unattended REFUSE --agent-seal"),
    "README-cli.md must keep the refusal sentence naming the five verbs that REFUSE --agent-seal (H3 · 315 V2 #4)",
  );
  const cwd = mkdtempSync(join(tmpdir(), "rapidtool-cli-seal-refusal-"));
  const env = { ...process.env };
  for (const key of ["DEEPSEEK_API_KEY", "RT_HUMAN_SEAT_TOKEN", "RAPIDTOOL_ACTOR", "RAPIDTOOL_LOG_DIR"]) {
    delete env[key];
  }
  try {
    for (const verb of ["approve", "gate"]) {
      // No --project: the refusal must fire on the flag alone, before any load.
      const res = spawnSync(process.execPath, ["--experimental-strip-types", CLI_PATH, verb, "--agent-seal"], {
        cwd,
        env,
        encoding: "utf8",
        timeout: 120_000,
      });
      assert.equal(res.error, undefined, `spawn failed: ${String(res.error)}`);
      const stderr = res.stderr ?? "";
      assert.ok(
        !/(^|\n)\s+at\s/.test(stderr),
        `${verb} --agent-seal must never print a Node stack:\n${stderr}`,
      );
      assert.equal(
        res.status,
        1,
        `${verb} --agent-seal → exit 1 (RT_E_VALIDATION is usage-class).\nstdout: ${res.stdout}\nstderr: ${stderr}`,
      );
      const json = JSON.parse(res.stdout);
      assert.equal(json.cmd, verb, "the envelope names the verb the flag was refused on");
      assert.equal(json.ok, false);
      assert.equal(json.code, "RT_E_VALIDATION", "the absorbed seal flag must classify coded, never be swallowed");
      assert.ok(
        String(json.error).includes(`${verb}: --agent-seal does not apply here`),
        `the refusal names the verb + flag: ${json.error}`,
      );
      assert.ok(
        String(json.remedy).includes("wild --start --agent-seal"),
        `the remedy names the ONE door that carries the seal: ${json.remedy}`,
      );
      assert.equal(json.exit_code, res.status, "the envelope's exit_code must equal the process exit");
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Leg 11 (316 · H7's survivability gap; I3 finisher — BEHAVIORAL spawn). H7's
// sweep verified the fresh-command floor (bare / unknown verb all refuse
// cleanly: exit 1, one JSON envelope, RT_E_VALIDATION, no stack) but nothing
// pinned it. One guard, three shapes: a fresh command must never answer with a
// Node stack, a non-canonical exit, or stderr output — and its refusal must
// carry the ERROR_CODE_DOC remedy (the K5/K6 coded-refusal seam).
// (`--help` moved OUT of this floor in W49 · 335-4: a help request is a
// SUCCESS now — see the help leg below.)
// ---------------------------------------------------------------------------
test("316 I3 — the fresh-command floor: bare / unknown verb refuse CODED (exit 1, RT_E_VALIDATION), never STACK", () => {
  const cwd = mkdtempSync(join(tmpdir(), "rapidtool-cli-floor-"));
  const env = { ...process.env };
  for (const key of ["DEEPSEEK_API_KEY", "RT_HUMAN_SEAT_TOKEN", "RAPIDTOOL_ACTOR", "RAPIDTOOL_LOG_DIR"]) {
    delete env[key];
  }
  const shapes = [
    { argv: [], label: "(bare)", errorMatch: "Missing subcommand.", cmd: null },
    { argv: ["noverb-316"], label: "unknown verb", errorMatch: "Unknown subcommand: noverb-316", cmd: "noverb-316" },
  ];
  try {
    for (const shape of shapes) {
      const res = spawnSync(process.execPath, ["--experimental-strip-types", CLI_PATH, ...shape.argv], {
        cwd,
        env,
        encoding: "utf8",
        timeout: 120_000,
      });
      assert.equal(res.error, undefined, `[${shape.label}] spawn failed: ${String(res.error)}`);
      const stderr = res.stderr ?? "";
      assert.ok(
        !/(^|\n)\s+at\s/.test(stderr),
        `[${shape.label}] the floor must never print a Node stack:\n${stderr}`,
      );
      assert.equal(
        res.status,
        1,
        `[${shape.label}] a fresh-command refusal is usage-class: exit 1.\nstdout: ${res.stdout}\nstderr: ${stderr}`,
      );
      let json = null;
      try {
        json = JSON.parse(res.stdout);
      } catch {
        /* surfaced by the assert below */
      }
      assert.ok(json, `[${shape.label}] exactly one JSON envelope on stdout.\nstdout: ${res.stdout}`);
      assert.equal(json.ok, false, `[${shape.label}] refusal envelope`);
      assert.equal(json.cmd, shape.cmd, `[${shape.label}] the envelope's cmd matches the invocation shape`);
      assert.equal(
        json.code,
        "RT_E_VALIDATION",
        `[${shape.label}] the floor is the validation class — a generic/missing code means the guard drifted`,
      );
      assert.ok(String(json.error).includes(shape.errorMatch), `[${shape.label}] error names the shape: ${json.error}`);
      assert.ok(
        typeof json.remedy === "string" && json.remedy.length > 0,
        `[${shape.label}] a coded refusal carries its ERROR_CODE_DOC remedy (the K5/K6 seam)`,
      );
      assert.equal(json.exit_code, res.status, `[${shape.label}] the envelope's exit_code must equal the process exit`);
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Leg 11b (W49 · 335-4, BEHAVIORAL spawn). Asking for help is a SUCCESS, not a
// coded refusal. Before this leg `--help` / `-h` / `help` were an empty or
// unknown subcommand (exit 1, ok:false) — an agent branching on the exit code
// read discovery as a failure. Now: ok:true, exit 0, `usage` present; naming a
// verb narrows `usage.commands` to that verb's one line.
// ---------------------------------------------------------------------------
test("W49 · 335-4: --help / -h / help are a SUCCESS (ok:true, exit 0); --help <verb> narrows to one verb", () => {
  const cwd = mkdtempSync(join(tmpdir(), "rapidtool-cli-help-"));
  const env = { ...process.env };
  for (const key of ["DEEPSEEK_API_KEY", "RT_HUMAN_SEAT_TOKEN", "RAPIDTOOL_ACTOR", "RAPIDTOOL_LOG_DIR"]) {
    delete env[key];
  }
  const runHelp = (argv) =>
    spawnSync(process.execPath, ["--experimental-strip-types", CLI_PATH, ...argv], {
      cwd,
      env,
      encoding: "utf8",
      timeout: 120_000,
    });
  try {
    for (const argv of [["--help"], ["-h"], ["help"]]) {
      const res = runHelp(argv);
      assert.equal(res.status, 0, `[${argv.join(" ")}] help must exit 0.\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
      const json = JSON.parse(res.stdout);
      assert.equal(json.ok, true, `[${argv.join(" ")}] help is a success envelope`);
      assert.equal(json.exit_code, 0);
      assert.equal(json.code, undefined, "help carries no error code");
      assert.ok(
        json.usage && json.usage.commands && Object.keys(json.usage.commands).length > 0,
        `[${argv.join(" ")}] the synopsis rides \`usage\``,
      );
      assert.ok(json.usage.commands.emit !== undefined, "every verb is listed (emit present)");
      assert.ok(typeof json.usage.help === "string" && json.usage.help.includes("exit 0"), "the help row is documented");
    }
    const narrowed = runHelp(["--help", "emit"]);
    assert.equal(
      narrowed.status,
      0,
      `--help emit must exit 0.\nstdout: ${narrowed.stdout}\nstderr: ${narrowed.stderr}`,
    );
    const nj = JSON.parse(narrowed.stdout);
    assert.equal(nj.verb, "emit");
    assert.deepEqual(Object.keys(nj.usage.commands), ["emit"], "naming a verb narrows usage.commands to it");
    assert.match(String(nj.usage.commands.emit), /--require-verified/, "the narrowed emit line carries the W49 flag");
    // README documents the behaviour.
    assert.match(readmeText, /Asking for help/, "README-cli.md must document the help request");
    assert.match(readmeText, /--help/, "README-cli.md must name the help flag");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Leg 11c (W49 · 335-4, BEHAVIORAL spawn). An agent branches on `remedy`; the
// registry's RT_E_VALIDATION agentAction is engine-voiced ("Reject the payload…
// ask for corrected input"), wrong for a mistyped CLI flag. Every CLI usage
// refusal must carry the concrete fix instead.
// ---------------------------------------------------------------------------
test("W49 · 335-4: a CLI usage refusal's remedy names the fix, not the engine-voiced registry action", () => {
  const cwd = mkdtempSync(join(tmpdir(), "rapidtool-cli-remedy-"));
  const env = { ...process.env };
  for (const key of ["DEEPSEEK_API_KEY", "RT_HUMAN_SEAT_TOKEN", "RAPIDTOOL_ACTOR", "RAPIDTOOL_LOG_DIR"]) {
    delete env[key];
  }
  const registry = "Reject the payload, state the concrete validation rule that failed";
  const cases = [
    { argv: ["create"], must: /--brief/ },
    { argv: ["emit"], must: /--project/ },
    { argv: ["edit"], must: /--dir/ },
    { argv: ["noverb-335"], must: /--help/ },
    { argv: ["knowledge", "--store", "k.json"], must: /--(save|find|help)/ },
  ];
  try {
    for (const c of cases) {
      const res = spawnSync(process.execPath, ["--experimental-strip-types", CLI_PATH, ...c.argv], {
        cwd,
        env,
        encoding: "utf8",
        timeout: 120_000,
      });
      assert.equal(res.status, 1, `[${c.argv.join(" ")}] usage refusal exits 1.\nstdout: ${res.stdout}`);
      const json = JSON.parse(res.stdout);
      assert.equal(json.code, "RT_E_VALIDATION", `[${c.argv.join(" ")}] refusal class`);
      assert.match(String(json.remedy), c.must, `[${c.argv.join(" ")}] remedy must name the fix`);
      assert.ok(
        !String(json.remedy).includes(registry),
        `[${c.argv.join(" ")}] remedy must not be the engine-voiced registry action`,
      );
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Leg 11d (W49 · 335-4, BEHAVIORAL spawn). A documented NUMERIC flag with a
// non-numeric value was silently dropped (the class the valueless guard left
// open): `search --limit abc` exited 0 on the default, `deepen --phase abc`
// fell back to the LIVE phase. Refused pre-dispatch now, naming the flag.
// ---------------------------------------------------------------------------
test("W49 · 335-4: a non-numeric value on a documented numeric flag is refused (exit 1, names the flag)", () => {
  const cwd = mkdtempSync(join(tmpdir(), "rapidtool-cli-numeric-"));
  const env = { ...process.env };
  for (const key of ["DEEPSEEK_API_KEY", "RT_HUMAN_SEAT_TOKEN", "RAPIDTOOL_ACTOR", "RAPIDTOOL_LOG_DIR"]) {
    delete env[key];
  }
  try {
    for (const flag of ["--limit", "--phase", "--steps", "--max-steps", "--budget"]) {
      const res = spawnSync(
        process.execPath,
        ["--experimental-strip-types", CLI_PATH, "mine", "--dir", ".", flag, "abc"],
        { cwd, env, encoding: "utf8", timeout: 120_000 },
      );
      assert.equal(res.status, 1, `[${flag} abc] must refuse.\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
      const json = JSON.parse(res.stdout);
      assert.equal(json.code, "RT_E_VALIDATION");
      assert.match(String(json.error), new RegExp(`${flag} expects a non-negative integer`));
      assert.ok(String(json.remedy).includes(flag), `[${flag}] the remedy names the flag`);
    }
    // A valid integer still dispatches (mine is keyless + read-only).
    const okRun = spawnSync(
      process.execPath,
      ["--experimental-strip-types", CLI_PATH, "mine", "--dir", ".", "--limit", "1"],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(okRun.status, 0, `a numeric --limit must stay legal.\nstdout: ${okRun.stdout}\nstderr: ${okRun.stderr}`);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Leg 12 (T8.2 · 314 F5 K2/K5 — 311_sd_product §1/§5 #2, BEHAVIORAL + source).
// The K2 integrity bug: a bare `approve` on a TTY silently fell through to
// `{decidedBy:"autopilot", seat:"harness"}` — a human's decision attributed to
// the machine; the non-TTY arm pointed at "the autopilot gate" with no exact
// next step. The F5 fix made the seat NAMED, exactly one of `--i-am-human`
// (human ceremony, TTY only) or `--seat autopilot` (explicit machine door).
// This leg drives a REAL parked gate (keyless create + `wild --start` parks on
// the P4 stock gate) and pins the three seat shapes end-to-end: bare refuse,
// non-seat `--seat` refuse, machine door works — plus the TTY arm's source
// bytes (unreachable from a non-PTY spawn; the spawn arms below exercise the
// non-TTY arm). The refusal fires AFTER the project load + gate-pending check
// (rapidtool-cli.mjs :929-1015), hence the real park.
// ---------------------------------------------------------------------------
test("T8.2 — approve's seat is never guessed: bare / non-seat refuse CODED; `--seat autopilot` is the machine door", () => {
  // TTY-arm source guard: the spawn arms below cannot carry a TTY, so the
  // K2-killed text (a bare approval would be attributed to the MACHINE) is
  // pinned as bytes: if it vanishes, that is a deliberate re-derivation.
  assert.ok(
    cliText.includes("process.stdin.isTTY === true"),
    "rapidtool-cli.mjs must keep the TTY arm of the seat refusal (the K2 bug: a bare TTY approve silently minted decidedBy:\"autopilot\")",
  );
  assert.match(
    cliText,
    /no seat named[\s\S]{0,400}seat is never guessed/,
    "the TTY arm's refusal text (bare approval would be attributed to the MACHINE — the seat is never guessed) must stay on disk",
  );
  const cwd = mkdtempSync(join(tmpdir(), "rapidtool-cli-seat-"));
  const env = { ...process.env };
  for (const key of ["DEEPSEEK_API_KEY", "RT_HUMAN_SEAT_TOKEN", "RAPIDTOOL_ACTOR", "RAPIDTOOL_LOG_DIR"]) {
    delete env[key];
  }
  try {
    // Harness: a real project parked on the P4 stock HITL gate, keyless. The
    // brief matches the lattice vocabulary so P0-P3 advance deterministically;
    // the classifier cannot self-approve keylessly ⇒ the loop parks at P4.
    const proj = join(cwd, "seat-pin.json");
    const created = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        CLI_PATH,
        "create",
        "--brief",
        "Build an inventory tracker for a small warehouse team: track products, stock levels, and reorder alerts with a simple dispatcher workflow.",
        "--name",
        "SeatPin",
        "--out",
        proj,
      ],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(created.status, 0, `fixture create failed.\nstdout: ${created.stdout}\nstderr: ${created.stderr}`);
    const walked = spawnSync(
      process.execPath,
      ["--experimental-strip-types", CLI_PATH, "wild", "--project", proj, "--start", "--steps", "8"],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(walked.status, 0, `wild --start must exit 0 (paused outcome).\nstdout: ${walked.stdout}\nstderr: ${walked.stderr}`);
    const walkedJson = JSON.parse(walked.stdout);
    assert.equal(walkedJson.outcome, "paused");
    assert.equal(
      walkedJson.summary.status,
      "awaiting_hitl",
      "harness precondition: the keyless wild run must park ON a gate (a drifted brief or floor moves the park — fix the fixture, never the assertions below)",
    );
    assert.equal(walkedJson.summary.currentPhase, 4, "the park must sit on the P4 stock gate for the approve legs");
    assert.equal(walkedJson.summary.nextAction?.kind, "approve", "the park's next action is the approval this leg pins");

    // Leg 1 — bare approve (non-TTY): the seat is never guessed (the 216/f5
    // guard that killed the silent machine-attribution fall-through).
    const bare = spawnSync(process.execPath, ["--experimental-strip-types", CLI_PATH, "approve", "--project", proj], {
      cwd,
      env,
      encoding: "utf8",
      timeout: 120_000,
    });
    const bareStderr = bare.stderr ?? "";
    assert.ok(
      !/(^|\n)\s+at\s/.test(bareStderr),
      `bare approve must never print a Node stack:\n${bareStderr}`,
    );
    assert.equal(
      bare.status,
      1,
      `bare approve → exit 1 (RT_E_VALIDATION is usage-class).\nstdout: ${bare.stdout}\nstderr: ${bareStderr}`,
    );
    const bareJson = JSON.parse(bare.stdout);
    assert.equal(bareJson.cmd, "approve");
    assert.equal(bareJson.ok, false);
    assert.equal(
      bareJson.code,
      "RT_E_VALIDATION",
      "an unnamed seat is a usage-class refusal — never a fall-through to a machine-attributed approval (K2)",
    );
    assert.ok(
      String(bareJson.error).includes("no claimable seat"),
      `the non-TTY refusal says WHY (no claimable seat exists off-TTY): ${bareJson.error}`,
    );
    assert.ok(
      String(bareJson.remedy).includes("--seat autopilot"),
      `the remedy names the machine door: ${bareJson.remedy}`,
    );
    assert.ok(
      String(bareJson.remedy).includes("--i-am-human"),
      `the remedy names the human door: ${bareJson.remedy}`,
    );
    assert.equal(bareJson.exit_code, bare.status, "the envelope's exit_code must equal the process exit");

    // Leg 2 — a NON-seat `--seat` value is refused with the 'autopilot' pointer.
    const bogus = spawnSync(
      process.execPath,
      ["--experimental-strip-types", CLI_PATH, "approve", "--project", proj, "--seat", "human"],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    const bogusStderr = bogus.stderr ?? "";
    assert.ok(
      !/(^|\n)\s+at\s/.test(bogusStderr),
      `--seat human must never print a Node stack:\n${bogusStderr}`,
    );
    assert.equal(bogus.status, 1, `a non-seat --seat value → exit 1.\nstdout: ${bogus.stdout}\nstderr: ${bogusStderr}`);
    const bogusJson = JSON.parse(bogus.stdout);
    assert.equal(bogusJson.ok, false);
    assert.equal(bogusJson.code, "RT_E_VALIDATION", "an unknown seat value is a usage-class refusal");
    assert.ok(
      String(bogusJson.error).includes('--seat "human" is not a seat'),
      `the refusal names the bad value verbatim: ${bogusJson.error}`,
    );
    assert.ok(
      String(bogusJson.error).includes("'autopilot'"),
      `the refusal names the ONE valid seat value: ${bogusJson.error}`,
    );
    assert.equal(bogusJson.exit_code, bogus.status, "the envelope's exit_code must equal the process exit");

    // Leg 3 — the explicit machine door works non-TTY and stamps its own seat.
    const autopilot = spawnSync(
      process.execPath,
      ["--experimental-strip-types", CLI_PATH, "approve", "--project", proj, "--seat", "autopilot"],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(
      autopilot.status,
      0,
      `\`--seat autopilot\` must approve (the documented machine door).\nstdout: ${autopilot.stdout}\nstderr: ${autopilot.stderr}`,
    );
    const apJson = JSON.parse(autopilot.stdout);
    assert.equal(apJson.ok, true);
    assert.equal(apJson.exit_code, autopilot.status, "the envelope's exit_code must equal the process exit");
    assert.equal(apJson.summary.currentPhase, 5, "the P4 gate was actually decided — the cursor moved to P5");
    const gate = apJson.summary.lastGate;
    assert.equal(gate?.phase, 4, "the recorded gate row is the P4 decision this leg made");
    assert.equal(gate?.decision, "approve");
    assert.equal(
      gate?.decidedBy,
      "autopilot",
      "the machine door stamps its OWN attribution — never a human seat (the whole point of the explicit door)",
    );
    assert.ok(
      String(gate?.note).includes("[seat harness]"),
      `the row carries the decisively-labeled machine seat tag: ${gate?.note}`,
    );
    // The on-disk project agrees (a real decision, not an envelope flourish).
    const onDisk = JSON.parse(readFileSync(proj, "utf8"));
    assert.equal(onDisk.status, "running", "the approved project left the awaiting_hitl park");
    assert.equal(onDisk.currentPhase, 5);
    assert.equal(onDisk.hitl ?? null, null, "the gate cleared — no stale hitl block");
    assert.equal(
      onDisk.decisions[onDisk.decisions.length - 1]?.decidedBy,
      "autopilot",
      "the minted ledger row carries the machine actor",
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// 326 F2b (C1) — approve/reject refusals on a NON-parked project must ship a
// remedy that points at a REAL next step: the guard fires exactly when no
// HITL door is open (hitl = null), so the registry's generic "route through
// the open HITL prompt" reads as a phantom door (E2-OBS-5 class; fixed for
// `gate`, pinned here for the approve/reject guards).
// ---------------------------------------------------------------------------
test("326 F2b C1 — approve/reject on a non-parked project refuse CODED with a real next step, never a phantom HITL door", () => {
  const cwd = mkdtempSync(join(tmpdir(), "rapidtool-cli-nodoor-"));
  const env = { ...process.env };
  for (const key of ["DEEPSEEK_API_KEY", "RT_HUMAN_SEAT_TOKEN", "RAPIDTOOL_ACTOR", "RAPIDTOOL_LOG_DIR"]) delete env[key];
  try {
    const proj = join(cwd, "nodoor-pin.json");
    const created = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        CLI_PATH,
        "create",
        "--brief",
        "Build an inventory tracker for a small warehouse team: track products, stock levels, and reorder alerts with a simple dispatcher workflow.",
        "--name",
        "NoDoorPin",
        "--out",
        proj,
      ],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(created.status, 0, `fixture create failed.\nstdout: ${created.stdout}\nstderr: ${created.stderr}`);
    for (const verb of ["approve", "reject"]) {
      const res = spawnSync(process.execPath, ["--experimental-strip-types", CLI_PATH, verb, "--project", proj], {
        cwd,
        env,
        encoding: "utf8",
        timeout: 120_000,
      });
      assert.ok(!/(^|\n)\s+at\s/.test(res.stderr ?? ""), `${verb}: refusal must never print a Node stack`);
      assert.equal(res.status, 1, `${verb} on a non-parked project is a coded refusal (exit 1).\nstdout: ${res.stdout}`);
      const json = JSON.parse(res.stdout);
      assert.equal(json.cmd, verb);
      assert.equal(json.ok, false);
      assert.equal(json.code, "RT_E_GATE_PENDING");
      assert.match(String(json.error), new RegExp(`No pending gate to ${verb} \\(status: intake\\)`));
      assert.ok(
        !String(json.remedy).includes("Route the project through the open HITL prompt"),
        `${verb}: remedy must NOT point at a HITL prompt that cannot exist (hitl = null) — the phantom door.`,
      );
      assert.match(String(json.remedy), /`gate`/, `${verb}: remedy names the real next step`);
      assert.match(String(json.remedy), /repaired, not approved/, `${verb}: keeps the red-gate honesty clause`);
      assert.match(String(json.remedy), /never fabricate a decision/, `${verb}: keeps the anti-fabrication clause`);
      assert.equal(json.exit_code, res.status, `${verb}: the envelope's exit_code must equal the process exit`);
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Leg 13 (W44 X2 · seeded ticket T / fixes/321_d2_monitor F-2 — BEHAVIORAL
// spawn). The minted forceHuman gate (review-reject park / failed P6 sandbox)
// is HUMAN-ONLY (R3/B-03). Before this leg, `approve --seat autopilot` on such
// a gate reached headless.approve, the engine's bare throw escaped to main()'s
// internal catch, and a DETERMINISTIC governance refusal came back wrapped as
// RT_E_INTERNAL / exit 4 + the generic "retry… escalate" remedy (live bytes:
// C:/Users/mnril/w44_trial/live1/03_sealed_approve_autopilot.out). The fix
// refuses CODED at the verb — usage class, exit 1, remedy = the human door —
// before the driver call, and decides nothing. This leg re-derives the exact
// shape keylessly: a real keyless park, then the gate's forceHuman bit flipped
// exactly as the review-reject mint writes it.
// ---------------------------------------------------------------------------
test("W44 X2 — a forceHuman gate refuses the autopilot door CODED (exit 1, human-door remedy), never RT_E_INTERNAL/exit 4", () => {
  const cwd = mkdtempSync(join(tmpdir(), "rapidtool-cli-forcehuman-"));
  const env = { ...process.env };
  for (const key of ["DEEPSEEK_API_KEY", "RT_HUMAN_SEAT_TOKEN", "RAPIDTOOL_ACTOR", "RAPIDTOOL_LOG_DIR"]) {
    delete env[key];
  }
  try {
    // Fixture: a real keyless park (the leg-12 harness), then the forceHuman
    // flip the review-reject mint applies (forceHuman: true on the hitl block).
    const proj = join(cwd, "forcehuman-pin.json");
    const created = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        CLI_PATH,
        "create",
        "--brief",
        "Build an inventory tracker for a small warehouse team: track products, stock levels, and reorder alerts with a simple dispatcher workflow.",
        "--name",
        "ForceHumanPin",
        "--out",
        proj,
      ],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(created.status, 0, `fixture create failed.\nstdout: ${created.stdout}\nstderr: ${created.stderr}`);
    const walked = spawnSync(
      process.execPath,
      ["--experimental-strip-types", CLI_PATH, "wild", "--project", proj, "--start", "--steps", "8"],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(walked.status, 0, `wild --start must exit 0 (paused outcome).\nstdout: ${walked.stdout}\nstderr: ${walked.stderr}`);
    const before = JSON.parse(readFileSync(proj, "utf8"));
    assert.equal(
      before.status,
      "awaiting_hitl",
      "fixture precondition: the keyless wild run parks on a gate (a drifted brief/floor — fix the fixture, never the assertions below)",
    );
    assert.ok(before.hitl && Number.isInteger(before.hitl.phase), "fixture precondition: the park carries a hitl block with its phase");
    assert.ok(!before.hitl.forceHuman, "fixture precondition: a STOCK park is not human-only — the flip below is the only difference");
    before.hitl.forceHuman = true; // the byte-shape the review-reject mint writes
    writeFileSync(proj, JSON.stringify(before, null, 2));
    const decisionsBefore = (before.decisions ?? []).length;

    const res = spawnSync(
      process.execPath,
      ["--experimental-strip-types", CLI_PATH, "approve", "--project", proj, "--seat", "autopilot"],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(res.error, undefined, `spawn failed: ${String(res.error)}`);
    const stderr = res.stderr ?? "";
    assert.ok(
      !/(^|\n)\s+at\s/.test(stderr),
      `a governance refusal must never print a Node stack (the RT_E_INTERNAL wrap this leg killed):\n${stderr}`,
    );
    assert.equal(
      res.status,
      1,
      `autopilot on a forceHuman gate → exit 1 (usage class). Exit 4 IS the regressed internal wrap.\nstdout: ${res.stdout}\nstderr: ${stderr}`,
    );
    let json = null;
    try {
      json = JSON.parse(res.stdout);
    } catch {
      /* surfaced below */
    }
    assert.ok(json, `exactly one JSON envelope on stdout.\nstdout: ${res.stdout}\nstderr: ${stderr}`);
    assert.equal(json.ok, false, "the refusal is a refusal envelope");
    assert.equal(json.cmd, "approve");
    assert.equal(
      json.code,
      "RT_E_VALIDATION",
      "a deterministic governance refusal is usage-class — a generic/missing code means the RT_E_INTERNAL wrap is back",
    );
    assert.ok(
      String(json.error).includes("human-only"),
      `the refusal says WHY (the gate is human-only): ${json.error}`,
    );
    assert.ok(
      String(json.error).includes("R3/B-03"),
      `the refusal cites the governance rule (R3/B-03): ${json.error}`,
    );
    assert.ok(
      String(json.error).includes(`P${before.hitl.phase}`),
      `the refusal names the open gate's phase: ${json.error}`,
    );
    assert.ok(
      String(json.remedy).includes("--i-am-human"),
      `the remedy is the human door: ${json.remedy}`,
    );
    assert.ok(
      String(json.remedy).includes("reject --project"),
      `the remedy keeps the send-back door visible: ${json.remedy}`,
    );
    assert.ok(
      !/may be transient|escalate with the raw message/.test(String(json.remedy)),
      `the generic internal-escalate remedy must never ride a policy refusal: ${json.remedy}`,
    );
    assert.equal(json.exit_code, res.status, "the envelope's exit_code must equal the process exit");

    // The refused attempt decided NOTHING: the human-only gate is still open.
    const after = JSON.parse(readFileSync(proj, "utf8"));
    assert.equal(after.status, "awaiting_hitl", "a refused machine attempt must not decide the gate");
    assert.equal(after.hitl?.forceHuman, true, "the human-only gate stays open for the human door");
    assert.equal(
      (after.decisions ?? []).length,
      decisionsBefore,
      "no ledger row may be minted by a refused attempt",
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Leg 14 (322 · F-1 scripts half + X1's R-A actor seam — BEHAVIORAL spawn).
// The reject door used to hardcode decidedBy:"human" for EVERY caller, so a
// non-TTY machine `reject --note` minted a human actor (live bytes:
// live1/05_sealed_reject_note.out — the exact forgery class approve's 314 F5
// guard killed). The reject verb now mirrors approve's explicit-seat
// discipline — exactly one seat: `--seat autopilot` (explicit machine
// attribution) or `--i-am-human` (human ceremony, TTY-only); a bare or
// non-seat value is refused CODED — and the chosen actor rides
// headless.reject's actor parameter (X1's R-A seam: engine rejectHitl takes
// `opts?.decidedBy`, absent ⇒ the legacy "human" default that keeps the
// console/store rows byte-identical; machine callers pass the explicit seat).
// This leg re-derives the shape keylessly: the same keyless park as leg 13,
// then the three reject doors.
// ---------------------------------------------------------------------------
test("322 F-1 — the reject door names its seat: bare / non-seat refuse CODED; `--seat autopilot` stamps its own machine actor", () => {
  const cwd = mkdtempSync(join(tmpdir(), "rapidtool-cli-rejectseat-"));
  const env = { ...process.env };
  for (const key of ["DEEPSEEK_API_KEY", "RT_HUMAN_SEAT_TOKEN", "RAPIDTOOL_ACTOR", "RAPIDTOOL_LOG_DIR"]) {
    delete env[key];
  }
  try {
    // Fixture: a real keyless park (the leg-13 harness).
    const proj = join(cwd, "rejectseat-pin.json");
    const created = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        CLI_PATH,
        "create",
        "--brief",
        "Build an inventory tracker for a small warehouse team: track products, stock levels, and reorder alerts with a simple dispatcher workflow.",
        "--name",
        "RejectSeatPin",
        "--out",
        proj,
      ],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(created.status, 0, `fixture create failed.\nstdout: ${created.stdout}\nstderr: ${created.stderr}`);
    const walked = spawnSync(
      process.execPath,
      ["--experimental-strip-types", CLI_PATH, "wild", "--project", proj, "--start", "--steps", "8"],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(walked.status, 0, `wild --start must exit 0 (paused outcome).\nstdout: ${walked.stdout}\nstderr: ${walked.stderr}`);
    const before = JSON.parse(readFileSync(proj, "utf8"));
    assert.equal(
      before.status,
      "awaiting_hitl",
      "fixture precondition: the keyless wild run parks on a gate (a drifted brief/floor — fix the fixture, never the assertions below)",
    );
    assert.ok(before.hitl && Number.isInteger(before.hitl.phase), "fixture precondition: the park carries a hitl block with its phase");
    const decisionsBefore = (before.decisions ?? []).length;

    // (1) A bare reject (non-TTY) names no claimable seat: refused CODED,
    // nothing minted — the seat is never guessed.
    const bare = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        CLI_PATH,
        "reject",
        "--project",
        proj,
        "--note",
        "The dispatcher workflow needs per-role reorder thresholds and an escalation path.",
      ],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    const bareStderr = bare.stderr ?? "";
    assert.ok(!/(^|\n)\s+at\s/.test(bareStderr), `a seat refusal must never print a Node stack:\n${bareStderr}`);
    assert.equal(bare.status, 1, `a bare reject must be refused CODED (exit 1).\nstdout: ${bare.stdout}\nstderr: ${bareStderr}`);
    const bareJson = JSON.parse(bare.stdout);
    assert.equal(bareJson.ok, false, "the bare refusal is a refusal envelope");
    assert.equal(bareJson.cmd, "reject");
    assert.equal(bareJson.code, "RT_E_VALIDATION", "an unclaimed seat is a usage-class refusal");
    assert.ok(
      String(bareJson.error).includes("no claimable seat"),
      `the refusal says the seat is unclaimed (non-TTY): ${bareJson.error}`,
    );
    assert.ok(
      String(bareJson.remedy).includes("--seat autopilot"),
      `the remedy names the machine door: ${bareJson.remedy}`,
    );
    assert.ok(
      String(bareJson.remedy).includes("--i-am-human"),
      `the remedy keeps the human door visible: ${bareJson.remedy}`,
    );
    assert.equal(bareJson.exit_code, bare.status, "the envelope's exit_code must equal the process exit");
    let mid = JSON.parse(readFileSync(proj, "utf8"));
    assert.equal(mid.status, "awaiting_hitl", "a refused bare reject must not decide the gate");
    assert.equal((mid.decisions ?? []).length, decisionsBefore, "no ledger row may be minted by a refused bare reject");

    // (2) A NON-seat `--seat` value is refused with the 'autopilot' pointer.
    const bogus = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        CLI_PATH,
        "reject",
        "--project",
        proj,
        "--note",
        "The dispatcher workflow needs per-role reorder thresholds and an escalation path.",
        "--seat",
        "human",
      ],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    const bogusStderr = bogus.stderr ?? "";
    assert.ok(!/(^|\n)\s+at\s/.test(bogusStderr), `--seat human must never print a Node stack:\n${bogusStderr}`);
    assert.equal(bogus.status, 1, `a non-seat --seat value → exit 1.\nstdout: ${bogus.stdout}\nstderr: ${bogusStderr}`);
    const bogusJson = JSON.parse(bogus.stdout);
    assert.equal(bogusJson.ok, false);
    assert.equal(bogusJson.code, "RT_E_VALIDATION");
    assert.ok(
      String(bogusJson.error).includes('--seat "human" is not a seat'),
      `the refusal names the bad value verbatim: ${bogusJson.error}`,
    );
    mid = JSON.parse(readFileSync(proj, "utf8"));
    assert.equal(mid.status, "awaiting_hitl", "a refused non-seat reject must not decide the gate");
    assert.equal((mid.decisions ?? []).length, decisionsBefore, "no ledger row may be minted by a refused non-seat reject");

    // (3) The explicit machine reject works non-TTY and stamps its OWN actor —
    // never a human seat (the whole point of the F-1 seam).
    const machine = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        CLI_PATH,
        "reject",
        "--project",
        proj,
        "--note",
        "The dispatcher workflow needs per-role reorder thresholds and an escalation path.",
        "--seat",
        "autopilot",
      ],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(
      machine.status,
      0,
      `\`reject --seat autopilot\` must land (the documented machine door).\nstdout: ${machine.stdout}\nstderr: ${machine.stderr}`,
    );
    const mJson = JSON.parse(machine.stdout);
    assert.equal(mJson.ok, true);
    assert.equal(mJson.exit_code, machine.status, "the envelope's exit_code must equal the process exit");
    assert.equal(mJson.summary.status, "blocked", "the rejection parks the project as blocked");
    assert.equal(mJson.summary.lastGate?.decision, "reject");
    assert.equal(
      mJson.summary.lastGate?.decidedBy,
      "autopilot",
      "the machine reject stamps its OWN attribution on lastGate — never a human seat (the F-1 forgery class)",
    );
    const onDisk = JSON.parse(readFileSync(proj, "utf8"));
    assert.equal(onDisk.status, "blocked", "the on-disk project agrees (a real decision, not an envelope flourish)");
    assert.equal(
      onDisk.decisions[onDisk.decisions.length - 1]?.decidedBy,
      "autopilot",
      'the minted ledger row carries the machine actor — a machine path never mints decidedBy:"human"',
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Leg 15 (fixes/323 FIX-2c · window #4 item 3, behavioral spawn). Exit-2
// parks are NOT failures: the pre-fix cli.invocation row read
// `level:"error", code:null` ("gate exit 2") and `diagnose` ranked it
// unclassified-errors / "not a clean bill of health". This leg spawns a REAL
// keyless park (`gate` — the inventory fixture parks on the P4 stock gate,
// exit 2) and reads the row back: level `warn`, `payload.parked:true`, code
// null (parks carry no RT_E code — codes are for surfaced failures).
// ---------------------------------------------------------------------------
test("FIX-2c — an exit-2 park stamps level warn + payload.parked on its cli.invocation row (never level:error)", () => {
  const cwd = mkdtempSync(join(tmpdir(), "rapidtool-cli-parkrow-"));
  const env = { ...process.env };
  for (const key of ["DEEPSEEK_API_KEY", "RT_HUMAN_SEAT_TOKEN", "RAPIDTOOL_ACTOR", "RAPIDTOOL_LOG_DIR"]) {
    delete env[key];
  }
  try {
    const proj = join(cwd, "parkrow.json");
    const created = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        CLI_PATH,
        "create",
        "--brief",
        "Build an inventory tracker for a small warehouse team: track products, stock levels, and reorder alerts with a simple dispatcher workflow.",
        "--name",
        "ParkRow",
        "--out",
        proj,
      ],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(created.status, 0, `fixture create failed.\nstdout: ${created.stdout}\nstderr: ${created.stderr}`);

    const parked = spawnSync(process.execPath, ["--experimental-strip-types", CLI_PATH, "gate", "--project", proj], {
      cwd,
      env,
      encoding: "utf8",
      timeout: 240_000,
    });
    assert.equal(
      parked.status,
      2,
      `gate must PARK (exit 2) on the stock gate.\nstdout: ${parked.stdout}\nstderr: ${parked.stderr}`,
    );
    const parkedJson = JSON.parse(parked.stdout);
    assert.equal(parkedJson.ok, true, "a clean park is ok:true (the exit-2 contract)");
    assert.equal(parkedJson.exit_code, parked.status, "the envelope's exit_code must equal the process exit");
    assert.equal(
      parkedJson.summary?.status,
      "awaiting_hitl",
      "harness precondition: the keyless gate run must park ON a gate (a drifted brief/floor — fix the fixture, never the assertions below)",
    );

    const logDir = join(cwd, ".rapidtool", "logs");
    assert.ok(existsSync(logDir), `the NDJSON log dir must exist at ${logDir}`);
    const rows = readdirSync(logDir)
      .filter((f) => f.endsWith(".ndjson"))
      .map((f) => readFileSync(join(logDir, f), "utf8"))
      .join("\n")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    const parkRows = rows.filter((r) => r.event === "cli.invocation" && r.payload?.exitCode === 2);
    assert.ok(
      parkRows.length >= 1,
      `the gate park must stamp a cli.invocation row ` +
        `(rows: ${rows.map((r) => `${r.event}/${r.payload?.exitCode}/${r.level}`).join(", ")})`,
    );
    for (const r of parkRows) {
      assert.equal(r.level, "warn", "an exit-2 park logs at warn — never error (F-3)");
      assert.equal(r.payload?.parked, true, "the park row carries the machine tag payload.parked:true");
      assert.equal(r.code ?? null, null, "no RT_E code rides a clean park — codes are for surfaced failures");
    }
    assert.ok(
      !rows.some((r) => r.payload?.exitCode === 2 && r.level === "error"),
      "no exit-2 row may log at error — the pre-fix defect this leg pins",
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Leg 16 (W44 A5 · fixes/325_a5_hunt.md B1+B3, source + behavioral spawns).
// The empty-VALUE half of the R5-f10 path-flag class: `--out=` / `--html=`
// store "" and used to pass every `typeof args.out === "string"` read, so
// `resolve("")` silently resolved the write target to the process CWD.
// Pre-fix live bytes (A5, scratch p1): `emit --out=` exit 0 + 15 files IN the
// cwd; `vault --out=` exit 0 + 17 files in the cwd; `packet --out=` exit 4
// (EISDIR opening the cwd dir as a file); `create --out=` exit 4 (rename onto
// the cwd dir) + a `.tmp-<pid>` leak beside it. The fix routes all seven
// guard sites through `pathFlagMissing` — the valueless message stays
// byte-identical, the empty value is named as such. This leg also pins B3:
// USAGE.reject must document its seat discipline (the 322 F-1 rule the help
// payload hid). Deliberate adaptation: A5's cap left a pin sketch for four
// verbs; this finisher widened the behavioral battery to every converted site
// (all seven) since each spawn is a swallowable keyless child.
// ---------------------------------------------------------------------------
test("W44 A5 — an empty-value path flag refuses CODED (exit 1, RT_E_VALIDATION, nothing written) — the --out= CWD melt", () => {
  // (a) source: every guard site reads pathFlagMissing (never the pre-fix
  // `=== true` spelling), and USAGE.reject documents both seats (B3).
  const guards = [
    ["create", "out"],
    ["packet", "out"],
    ["export", "out"],
    ["emit", "out"],
    ["vault", "out"],
    ["design", "html"],
    ["diagram", "out"],
  ];
  for (const [verb, key] of guards) {
    const armStart = cliText.indexOf(`case "${verb}":`);
    assert.ok(armStart !== -1, `the ${verb} arm must exist in the CLI source`);
    const nextCase = cliText.indexOf('case "', armStart + 10);
    const arm = cliText.slice(armStart, nextCase === -1 ? undefined : nextCase);
    assert.match(
      arm,
      new RegExp(`if \\(pathFlagMissing\\(args\\.${key}\\)\\)`),
      `the ${verb} arm's --${key} guard must use pathFlagMissing — an EMPTY value (--${key}=) must never melt into the CWD`,
    );
  }
  assert.ok(
    !/args\.out === true|args\.html === true/.test(cliText),
    "the valueless-only `=== true` spelling is back — it lets `--out=` (empty string) pass every `typeof === \"string\"` read into resolve(\"\")",
  );
  const rejectUsage = cliText.match(/\n {4}reject: "([^"]*)",/);
  assert.ok(rejectUsage, "USAGE must carry a reject entry");
  assert.match(
    rejectUsage[1],
    /--seat autopilot/,
    "USAGE.reject must document the explicit machine seat (322 F-1: a bare reject is never guessed a seat)",
  );
  assert.match(rejectUsage[1], /--i-am-human/, "USAGE.reject must document the human-seat door it requires");

  // (b) behavioral: one empty-value spawn per converted site, each in a FRESH
  // melt cwd that must stay untouched (pre-fix the melt wrote INTO it).
  const cwd = mkdtempSync(join(tmpdir(), "rapidtool-cli-emptyval-"));
  const env = { ...process.env };
  for (const key of ["DEEPSEEK_API_KEY", "RT_HUMAN_SEAT_TOKEN", "RAPIDTOOL_ACTOR", "RAPIDTOOL_LOG_DIR"]) {
    delete env[key];
  }
  const BRIEF_EMPTYVAL =
    "Build an inventory tracker for a small warehouse team: track products, stock levels, and reorder alerts with a simple dispatcher workflow.";
  try {
    const proj = join(cwd, "emptyval.json");
    const created = spawnSync(
      process.execPath,
      ["--experimental-strip-types", CLI_PATH, "create", "--brief", BRIEF_EMPTYVAL, "--name", "EmptyVal", "--out", proj],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(created.status, 0, `fixture create failed.\nstdout: ${created.stdout}\nstderr: ${created.stderr}`);

    const cases = [
      {
        label: "create --out=",
        dir: "melt-create",
        argv: ["create", "--brief", BRIEF_EMPTYVAL, "--name", "MeltC", "--out="],
        errorMatch: "create --out requires a path (got an empty value)",
      },
      {
        label: "packet --out=",
        dir: "melt-packet",
        argv: ["packet", "--project", proj, "--out="],
        errorMatch: "packet --out requires a path (got an empty value)",
      },
      {
        label: "emit --out=",
        dir: "melt-emit",
        argv: ["emit", "--project", proj, "--out="],
        errorMatch: "emit --out requires a path (got an empty value)",
      },
      {
        label: "vault --out=",
        dir: "melt-vault",
        argv: ["vault", "--project", proj, "--out="],
        errorMatch: "vault --out requires a path (got an empty value)",
      },
      {
        label: "export --out=",
        dir: "melt-export",
        argv: ["export", "--project", proj, "--out="],
        errorMatch: "export --out requires a path (got an empty value)",
      },
      {
        label: "design --html=",
        dir: "melt-design",
        argv: ["design", "--project", proj, "--html="],
        errorMatch: "design --html requires a path (got an empty value)",
      },
      {
        label: "diagram --out=",
        dir: "melt-diagram",
        argv: ["diagram", "--project", proj, "--kind", "phases", "--out="],
        errorMatch: "diagram --out requires a path (got an empty value)",
      },
    ];
    for (const shape of cases) {
      const melt = join(cwd, shape.dir);
      mkdirSync(melt, { recursive: true });
      const res = spawnSync(process.execPath, ["--experimental-strip-types", CLI_PATH, ...shape.argv], {
        cwd: melt,
        env,
        encoding: "utf8",
        timeout: 120_000,
      });
      const stderr = res.stderr ?? "";
      assert.ok(!/(^|\n)\s+at\s/.test(stderr), `[${shape.label}] an empty-value refusal must never print a Node stack:\n${stderr}`);
      assert.equal(
        res.status,
        1,
        `[${shape.label}] an empty-value path flag is usage-class: exit 1, nothing written (pre-fix: exit 0 with the tree melted into the cwd, or exit 4).\nstdout: ${res.stdout}\nstderr: ${stderr}`,
      );
      let json = null;
      try {
        json = JSON.parse(res.stdout);
      } catch {
        /* surfaced below */
      }
      assert.ok(json, `[${shape.label}] exactly one JSON envelope on stdout.\nstdout: ${res.stdout}`);
      assert.equal(json.ok, false, `[${shape.label}] refusal envelope`);
      assert.equal(json.code, "RT_E_VALIDATION", `[${shape.label}] the empty-value refusal is the validation class`);
      assert.ok(String(json.error).includes(shape.errorMatch), `[${shape.label}] error names the empty value: ${json.error}`);
      assert.equal(json.exit_code, res.status, `[${shape.label}] the envelope's exit_code must equal the process exit`);
      const strays = readdirSync(melt).filter((f) => f !== ".rapidtool");
      assert.deepEqual(
        strays,
        [],
        `[${shape.label}] the melt cwd must stay untouched — pre-fix this exact spelling emitted INTO the cwd (got: ${strays.join(", ")})`,
      );
    }

    // The valueless R5-f10 spelling keeps its ORIGINAL refusal bytes — the
    // empty-value widening must not have loosened the older guard.
    const meltBare = join(cwd, "melt-valueless");
    mkdirSync(meltBare, { recursive: true });
    const bare = spawnSync(
      process.execPath,
      ["--experimental-strip-types", CLI_PATH, "create", "--brief", BRIEF_EMPTYVAL, "--name", "MeltV", "--out"],
      { cwd: meltBare, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(
      bare.status,
      1,
      `[create --out (valueless)] exit 1.\nstdout: ${bare.stdout}\nstderr: ${bare.stderr}`,
    );
    const bareJson = JSON.parse(bare.stdout);
    assert.equal(bareJson.code, "RT_E_VALIDATION");
    assert.ok(
      String(bareJson.error).includes("create --out requires a path (got a flag with no value)"),
      `the R5-f10 valueless refusal must stay byte-identical: ${bareJson.error}`,
    );
    assert.deepEqual(readdirSync(meltBare).filter((f) => f !== ".rapidtool"), [], "the valueless refusal writes nothing either");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// W44 F2c (C2 · monitors' OBS-T3-1, adjudicated A) — `create`'s exit row is
// scoped to the project it CREATED: CLI_PROJECT = out lands after saveProject
// and before respond (which exits in-tick), so the row goes to
// <--out dir>/.rapidtool/logs, never the invoker's cwd. Failure paths (no
// project on disk yet) still stamp the cwd — that half is unchanged.
// ---------------------------------------------------------------------------
test("W44 F2c C2 — a create whose --out lands elsewhere stamps its exit row NEXT TO the created project, never the invoker's cwd (OBS-T3-1)", () => {
  const cwd = mkdtempSync(join(tmpdir(), "rapidtool-cli-createscope-"));
  const env = { ...process.env };
  for (const key of ["DEEPSEEK_API_KEY", "RT_HUMAN_SEAT_TOKEN", "RAPIDTOOL_ACTOR", "RAPIDTOOL_LOG_DIR"]) delete env[key];
  try {
    mkdirSync(join(cwd, "sub"), { recursive: true });
    const proj = join(cwd, "sub", "createscope-pin.json");
    const created = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        CLI_PATH,
        "create",
        "--brief",
        "Build an inventory tracker for a small warehouse team: track products, stock levels, and reorder alerts with a simple dispatcher workflow.",
        "--name",
        "CreateScopePin",
        "--out",
        proj,
      ],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(created.status, 0, `fixture create failed.\nstdout: ${created.stdout}\nstderr: ${created.stderr}`);
    const createdJson = JSON.parse(created.stdout);
    assert.equal(createdJson.exit_code, created.status, "the envelope's exit_code must equal the process exit");

    const rowsOf = (dir) => {
      if (!existsSync(dir)) return [];
      return readdirSync(dir)
        .filter((f) => f.endsWith(".ndjson"))
        .flatMap((f) => readFileSync(join(dir, f), "utf8").split(/\r?\n/))
        .filter(Boolean)
        .map((l) => JSON.parse(l));
    };

    // POSITIVE: the created project's own log carries its birth row.
    const outLogDir = join(cwd, "sub", ".rapidtool", "logs");
    const outRows = rowsOf(outLogDir);
    const outCreate = outRows.filter((r) => r.event === "cli.invocation" && r.payload?.cmd === "create");
    assert.equal(
      outCreate.length,
      1,
      `the create exit row must land next to the created project (${outLogDir}); got rows: ${outRows.map((r) => r.event).join(", ")}`,
    );
    assert.equal(outCreate[0].host, "cli", "host glue stamps cli");
    assert.equal(outCreate[0].payload?.exitCode, 0, "the row records the successful exit");

    // NEGATIVE: the invoker's cwd log holds NO create row (the OBS-T3-1
    // pollution — trial cwd logs collected every create of every project).
    const cwdCreate = rowsOf(join(cwd, ".rapidtool", "logs")).filter(
      (r) => r.event === "cli.invocation" && r.payload?.cmd === "create",
    );
    assert.equal(cwdCreate.length, 0, "the invoker's cwd log must not hold the create row when --out points elsewhere");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// 326 F2d (T3 [NEW-BUG] · doctor --tree path honesty; pre-fix bytes:
// t3_scratch/dryrun_doctor_nopath.txt) — a non-existent `--tree` used to exit
// 0 with ok:true / stubs:0 / files:[] — a false bill of health for a scan
// that never happened. Now: coded RT_E_VALIDATION refusal (exit 1, the
// `edit --dir` missing-dir class); a non-directory --tree refuses too (a
// file path was false-empty before), and a real stub tree still scans.
// ---------------------------------------------------------------------------
test("326 F2d — `doctor --tree` refuses CODED on a non-existent / non-directory path (exit 1, RT_E_VALIDATION), never a false-clean ok:true census", () => {
  const cwd = mkdtempSync(join(tmpdir(), "rapidtool-cli-doctree-"));
  const env = { ...process.env };
  for (const key of ["DEEPSEEK_API_KEY", "RT_HUMAN_SEAT_TOKEN", "RAPIDTOOL_ACTOR", "RAPIDTOOL_LOG_DIR"]) delete env[key];
  try {
    const tree = join(cwd, "tree");
    mkdirSync(join(tree, "src", "jobs"), { recursive: true });
    writeFileSync(
      join(tree, "src", "jobs", "deliver_core_workflow.ts"),
      'export function deliverCoreWorkflow() {\n  // TODO(E-15): stub\n  throw new Error("TODO");\n}\n',
    );
    const doctor = (target) =>
      spawnSync(process.execPath, ["--experimental-strip-types", CLI_PATH, "doctor", "--tree", target], {
        cwd,
        env,
        encoding: "utf8",
        timeout: 120_000,
      });

    // CONTROL: the real tree still scans — the TODO(E-15) file is one stub.
    const win = doctor(tree);
    assert.equal(win.status, 0, `control scan failed.\nstdout: ${win.stdout}\nstderr: ${win.stderr}`);
    const winJson = JSON.parse(win.stdout);
    assert.equal(winJson.ok, true);
    assert.equal(winJson.factory.inventory.stubs, 1, "the TODO(E-15) stub must be in the census");
    assert.equal(winJson.factory.inventory.files[0]?.path, "src/jobs/deliver_core_workflow.ts");
    assert.equal(winJson.exit_code, win.status);

    // NON-EXISTENT: coded refusal — never ok:true/stubs:0.
    const nopath = doctor(join(cwd, "NOPE_XYZ"));
    assert.ok(!/(^|\n)\s+at\s/.test(nopath.stderr ?? ""), "refusal must never print a Node stack");
    assert.equal(nopath.status, 1, `a non-existent --tree is a coded refusal (exit 1).\nstdout: ${nopath.stdout}`);
    const nopathJson = JSON.parse(nopath.stdout);
    assert.equal(nopathJson.ok, false, "a scan that never happened must never be ok:true");
    assert.equal(nopathJson.code, "RT_E_VALIDATION");
    assert.match(String(nopathJson.error), /does not exist — nothing to scan/);
    assert.equal(nopathJson.exit_code, nopath.status);

    // NON-DIRECTORY: a file as --tree was a false-empty scan too.
    const filePath = join(cwd, "not-a-tree.ts");
    writeFileSync(filePath, "export {};\n");
    const nodir = doctor(filePath);
    assert.equal(nodir.status, 1, `a file as --tree is a coded refusal (exit 1).\nstdout: ${nodir.stdout}`);
    const nodirJson = JSON.parse(nodir.stdout);
    assert.equal(nodirJson.ok, false);
    assert.equal(nodirJson.code, "RT_E_VALIDATION");
    assert.match(String(nodirJson.error), /is not a directory — nothing to scan/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// 326 F2d (T3 [NEW-BUG] #2; pre-fix bytes: t3_scratch/dryrun_doctor_game_msys
// .txt vs dryrun_doctor_game_win.txt) — git-bash hands `/c/Users/...` to the
// CLI verbatim, and resolve() on win32 mangled it into `C:\c\Users\...` (a
// silent FALSE-EMPTY scan) while the Windows-form path returned stubs:1.
// Now the single-letter drive form is translated BEFORE resolve() — the MSYS
// scan returns the SAME inventory as the win form — and any other POSIX
// literal refuses CODED instead of being silently mapped onto a drive root.
// ---------------------------------------------------------------------------
test(
  "326 F2d — `doctor --tree` translates MSYS drive forms (/c/...) to the Windows form: same inventory as win form, never silent mangling",
  { skip: process.platform !== "win32" ? "win32-only: MSYS drive forms only exist against a Windows host" : false },
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "rapidtool-cli-doctreemsys-"));
    const env = { ...process.env };
    for (const key of ["DEEPSEEK_API_KEY", "RT_HUMAN_SEAT_TOKEN", "RAPIDTOOL_ACTOR", "RAPIDTOOL_LOG_DIR"]) delete env[key];
    try {
      const tree = join(cwd, "tree");
      mkdirSync(join(tree, "src", "jobs"), { recursive: true });
      writeFileSync(
        join(tree, "src", "jobs", "deliver_core_workflow.ts"),
        'export function deliverCoreWorkflow() {\n  // TODO(E-15): stub\n  throw new Error("TODO");\n}\n',
      );
      const msys = "/" + tree[0].toLowerCase() + tree.slice(2).replace(/\\/g, "/"); // C:\x → /c/x
      const doctor = (target) =>
        spawnSync(process.execPath, ["--experimental-strip-types", CLI_PATH, "doctor", "--tree", target], {
          cwd,
          env,
          encoding: "utf8",
          timeout: 120_000,
        });

      const win = doctor(tree);
      assert.equal(win.status, 0, `win-form control failed.\nstdout: ${win.stdout}\nstderr: ${win.stderr}`);
      const winJson = JSON.parse(win.stdout);

      const msysRes = doctor(msys);
      assert.equal(msysRes.status, 0, `MSYS-form scan must succeed.\nstdout: ${msysRes.stdout}\nstderr: ${msysRes.stderr}`);
      const msysJson = JSON.parse(msysRes.stdout);
      assert.equal(msysJson.ok, true);
      const driveCaseNormalized = (inv) => ({ ...inv, scanned: String(inv.scanned).toLowerCase() });
      assert.deepEqual(
        driveCaseNormalized(msysJson.factory.inventory),
        driveCaseNormalized(winJson.factory.inventory),
        "the MSYS form must scan the SAME census as the Windows form (no C:\\c\\... shadow)",
      );

      // A non-drive POSIX literal has no unambiguous win32 meaning: refusal.
      const posix = doctor("/tmp/f2d-not-a-mapped-drive");
      assert.equal(posix.status, 1, "an unmappable POSIX literal refuses (exit 1)");
      const posixJson = JSON.parse(posix.stdout);
      assert.equal(posixJson.ok, false);
      assert.equal(posixJson.code, "RT_E_VALIDATION");
      assert.match(String(posixJson.error), /POSIX-style path/);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
);

// ---------------------------------------------------------------------------
// 330 Switchboard (BEHAVIORAL spawn). The agent seal is a WILD-RUN concept: the
// CLI banner and USAGE.wild both say `wild` is "the ONLY verb that accepts it",
// yet until 330 only five drive verbs refused it (316 H3) — every OTHER verb
// (reject/emit/create/scan/…) silently absorbed the governance flag and
// returned a SUCCESS envelope (probed pre-fix: `reject/emit/create/scan
// --agent-seal` all exit 0 ok:true). A governance flag is never silently
// ignored, so the refusal is hoisted to ONE pre-dispatch guard. This leg spawns
// every family verb with the bare flag (no --project — the refusal fires on the
// flag alone, before any load) and asserts the coded pointer, plus that `wild`
// is NOT caught by that guard (it is the ONE door).
// ---------------------------------------------------------------------------
test("330 Switchboard — `--agent-seal` refuses CODED on every verb but `wild` (the ONE door)", () => {
  const cwd = mkdtempSync(join(tmpdir(), "rapidtool-cli-seal-all-"));
  const env = { ...process.env };
  for (const key of ["DEEPSEEK_API_KEY", "RT_HUMAN_SEAT_TOKEN", "RAPIDTOOL_ACTOR", "RAPIDTOOL_LOG_DIR"]) delete env[key];
  try {
    // One verb per family, incl. the four that silently absorbed it pre-fix.
    const verbs = [
      "reject", "emit", "create", "scan", "edit", "summary", "packet", "export",
      "doctor", "vault", "bench", "swarm", "mine", "knowledge", "chat", "deepen",
      "fixtures", "harvest", "prompt", "verify", "crew", "lesson", "artifacts",
      "design", "diagram", "search", "tree-run", "repair", "ingest", "retry",
      "unattended", "resume", "approve", "gate", "run",
    ];
    for (const verb of verbs) {
      const res = spawnSync(process.execPath, ["--experimental-strip-types", CLI_PATH, verb, "--agent-seal"], {
        cwd,
        env,
        encoding: "utf8",
        timeout: 120_000,
      });
      assert.equal(res.status, 1, `${verb} --agent-seal → exit 1 (usage-class).\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
      assert.ok(!/(^|\n)\s+at\s/.test(res.stderr ?? ""), `${verb} --agent-seal must never print a Node stack`);
      const json = JSON.parse(res.stdout);
      assert.equal(json.cmd, verb, "the envelope names the verb the flag was refused on");
      assert.equal(json.ok, false, `${verb}: the absorbed governance flag must never ride a success envelope`);
      assert.equal(json.code, "RT_E_VALIDATION");
      assert.ok(
        String(json.error).includes(`${verb}: --agent-seal does not apply here`),
        `${verb}: the refusal names the verb + flag: ${json.error}`,
      );
      assert.ok(String(json.remedy).includes("wild --start --agent-seal"), `${verb}: remedy names the ONE door`);
      assert.equal(json.exit_code, res.status, `${verb}: envelope exit_code must equal the process exit`);
    }
    // `wild` is the ONE door — the pre-dispatch guard must not catch it (with no
    // --project it refuses for the missing arg, NOT for the seal).
    const wild = spawnSync(process.execPath, ["--experimental-strip-types", CLI_PATH, "wild", "--agent-seal"], {
      cwd,
      env,
      encoding: "utf8",
      timeout: 120_000,
    });
    const wj = JSON.parse(wild.stdout);
    assert.ok(
      !String(wj.error).includes("--agent-seal does not apply here"),
      `wild is the ONE verb that accepts the seal; it must not refuse its own flag: ${wj.error}`,
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// 330 Switchboard (BEHAVIORAL spawn). R5-f10/A2-f11 refused a VALUELESS path
// flag for `--out`/`--html`; the `packet --knowledge` flag shipped without that
// guard — a bare `--knowledge` parses to `true`, the `typeof === "string"` read
// silently ignored it, and the packet was served UNSEEDED under a success
// envelope (probed pre-fix: `packet --project P --knowledge` → exit 0 ok:true).
// Both spellings now refuse CODED; a real store still seeds (smoke).
// ---------------------------------------------------------------------------
test("330 Switchboard — `packet --knowledge` refuses a valueless/empty flag CODED, a real store still seeds", () => {
  const cwd = mkdtempSync(join(tmpdir(), "rapidtool-cli-knowledgeflag-"));
  const env = { ...process.env };
  for (const key of ["DEEPSEEK_API_KEY", "RT_HUMAN_SEAT_TOKEN", "RAPIDTOOL_ACTOR", "RAPIDTOOL_LOG_DIR"]) delete env[key];
  try {
    const proj = join(cwd, "proj.json");
    const store = join(cwd, "store.json");
    const created = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        CLI_PATH,
        "create",
        "--brief",
        "Build an inventory tracker for a small warehouse team: track products, stock levels, and reorder alerts with a simple dispatcher workflow.",
        "--name",
        "KnowledgeFlagPin",
        "--out",
        proj,
      ],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(created.status, 0, `fixture create failed.\nstdout: ${created.stdout}\nstderr: ${created.stderr}`);

    for (const spelling of ["--knowledge", "--knowledge="]) {
      const res = spawnSync(
        process.execPath,
        ["--experimental-strip-types", CLI_PATH, "packet", "--project", proj, spelling],
        { cwd, env, encoding: "utf8", timeout: 120_000 },
      );
      assert.equal(res.status, 1, `packet ${spelling} must refuse (exit 1).\nstdout: ${res.stdout}`);
      const json = JSON.parse(res.stdout);
      assert.equal(json.ok, false, `packet ${spelling}: the valueless knowledge flag must not melt away`);
      assert.equal(json.code, "RT_E_VALIDATION");
      assert.match(String(json.error), /--knowledge requires a path/);
    }

    const saved = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        CLI_PATH,
        "knowledge",
        "--store",
        store,
        "--save",
        JSON.stringify({
          project: "OTHER PROJECT",
          kind: "fix",
          title: "Warehouse reorder guidance",
          tags: ["lesson"],
          body: "Reorder before stockout; verify thresholds.",
          score: 0.9,
        }),
      ],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(saved.status, 0, `store fixture save failed.\nstdout: ${saved.stdout}\nstderr: ${saved.stderr}`);
    const seeded = spawnSync(
      process.execPath,
      ["--experimental-strip-types", CLI_PATH, "packet", "--project", proj, "--knowledge", store],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(seeded.status, 0, `packet --knowledge <store> must succeed.\nstdout: ${seeded.stdout}`);
    assert.equal(JSON.parse(seeded.stdout).ok, true);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// 330 Switchboard (T4 — BEHAVIORAL spawn). `run`/`gate`/`unattended` gained the
// same `--knowledge <store.json>` seed `packet` carries: the CLI resolves the
// store through knowledge.provenRowsFromStore and hands the rows to the headless
// driver as `proven` (the T4 synthesis-prompt hop). A configured store that
// cannot be read is the SAME coded refusal as the packet arm (exit 4, the
// store's own reason); a valueless flag refuses coded; absent flag is the
// unchanged drive.
// ---------------------------------------------------------------------------
test("330 Switchboard (T4) — `run`/`gate`/`unattended --knowledge`: accepted store, coded degraded refusal, valueless refusal", () => {
  const cwd = mkdtempSync(join(tmpdir(), "rapidtool-cli-t4knowledge-"));
  const env = { ...process.env };
  for (const key of ["DEEPSEEK_API_KEY", "RT_HUMAN_SEAT_TOKEN", "RAPIDTOOL_ACTOR", "RAPIDTOOL_LOG_DIR"]) delete env[key];
  try {
    const proj = join(cwd, "proj.json");
    const store = join(cwd, "store.json");
    const bad = join(cwd, "bad.json");
    writeFileSync(bad, "{ not json", "utf8");
    const created = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        CLI_PATH,
        "create",
        "--brief",
        "Build a servo tuning rig for CNC loop calibration with a dispatcher.",
        "--name",
        "T4KnowledgePin",
        "--out",
        proj,
      ],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(created.status, 0, `fixture create failed.\nstdout: ${created.stdout}\nstderr: ${created.stderr}`);
    const saved = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        CLI_PATH,
        "knowledge",
        "--store",
        store,
        "--save",
        JSON.stringify({
          project: "OTHER PROJECT",
          kind: "fix",
          title: "Calibrate servo loop gains",
          tags: ["lesson"],
          body: "Tighten the servo loop gains from the deterministic floor.",
          score: 0.9,
        }),
      ],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(saved.status, 0, `store fixture save failed.\nstdout: ${saved.stdout}\nstderr: ${saved.stderr}`);

    // Accepted on all three drive verbs (parked exit 2, or 0 mid-run — never a
    // knowledge-specific refusal).
    for (const verb of ["run", "gate", "unattended"]) {
      const res = spawnSync(
        process.execPath,
        ["--experimental-strip-types", CLI_PATH, verb, "--project", proj, "--knowledge", store],
        { cwd, env, encoding: "utf8", timeout: 180_000 },
      );
      assert.ok(res.status === 0 || res.status === 2, `${verb} --knowledge <store> must be accepted: exit ${res.status}\n${res.stdout}`);
      const json = JSON.parse(res.stdout);
      assert.ok(
        !String(json.error).includes("cannot seed proven lessons"),
        `${verb}: a readable store must not be refused: ${json.error}`,
      );
    }

    // Degraded (corrupt) store → exit 4, RT_E_VALIDATION, the store's own reason.
    const degraded = spawnSync(
      process.execPath,
      ["--experimental-strip-types", CLI_PATH, "run", "--project", proj, "--knowledge", bad],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(degraded.status, 4, `a corrupt store is a coded runtime refusal (exit 4).\nstdout: ${degraded.stdout}`);
    const dj = JSON.parse(degraded.stdout);
    assert.equal(dj.ok, false);
    assert.equal(dj.code, "RT_E_VALIDATION", "the degraded store carries the resolver's own code");
    assert.match(String(dj.error), /cannot seed proven lessons from .*bad\.json/);

    // Valueless flag → exit 1 usage refusal (never a silent no-op).
    const bare = spawnSync(
      process.execPath,
      ["--experimental-strip-types", CLI_PATH, "run", "--project", proj, "--knowledge"],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(bare.status, 1, "a valueless --knowledge refuses (exit 1)");
    const bj = JSON.parse(bare.stdout);
    assert.equal(bj.code, "RT_E_VALIDATION");
    assert.match(String(bj.error), /--knowledge requires a path/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});


// ---------------------------------------------------------------------------
// Leg 21 (W45 · 331-1 Keywright) — API-key resolution + the loud coded conflict.
//
// F1: the CLI used to read the process environment only, so a stale Windows
// User-scope DEEPSEEK_API_KEY silently shadowed the funded key in the repo
// `.env` and every keyed call 401'd on a key the operator never chose. The fix
// resolves `<cwd>/.env` > process env and surfaces a DIFFERENT ambient key as a
// loud, coded, tail-only signal on stderr (stdout stays one JSON object).
// ---------------------------------------------------------------------------
const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

test("W45 331-1 — a conflicting ambient key is LOUD + CODED (RT_E_LLM_KEY_SHADOWED), .env wins, tail-only", () => {
  const envPath = join(REPO_ROOT, ".env");
  if (!existsSync(envPath)) return; // no .env in this checkout → nothing to shadow
  const m = /^\s*DEEPSEEK_API_KEY\s*=\s*(.+?)\s*$/m.exec(readFileSync(envPath, "utf8"));
  if (!m) return;
  const envKey = m[1].replace(/^["']|["']$/g, "");
  if (!envKey) return;
  const envTail = envKey.slice(-4);
  const ambient = "sk-ambient-0000000000000000000000ZZZZ";

  const res = spawnSync(process.execPath, ["--experimental-strip-types", CLI_PATH, "create"], {
    cwd: REPO_ROOT,
    env: { ...process.env, DEEPSEEK_API_KEY: ambient },
    encoding: "utf8",
    timeout: 120_000,
  });
  const stderr = res.stderr ?? "";
  // The refusal is the ordinary missing-brief validation — the conflict is a
  // DIAGNOSTIC, never a fatal refusal (a clean shell must still succeed).
  assert.equal(res.status, 1, `a usage refusal stays exit 1.\nstdout: ${res.stdout}\nstderr: ${stderr}`);
  const json = JSON.parse(res.stdout); // stdout is STILL exactly one JSON object
  assert.equal(json.code, "RT_E_VALIDATION");
  assert.match(stderr, /RT_E_LLM_KEY_SHADOWED/, "the conflict must be LOUD and CODED on stderr");
  assert.ok(stderr.includes("ZZZZ"), "must name the ambient key's last-4 tail");
  assert.ok(stderr.includes(envTail), "must name the .env key's last-4 tail");
  assert.ok(!stderr.includes(ambient), "never the full ambient key");
  assert.ok(!stderr.includes(envKey), "never the full .env key");
});

test("W45 331-1 — a .env elsewhere does not leak into a child spawned with a different cwd (keyless isolation)", () => {
  const cwd = mkdtempSync(join(tmpdir(), "rapidtool-cli-dotenv-"));
  try {
    const ambient = "sk-ambient-0000000000000000000000ZZZZ";
    const res = spawnSync(process.execPath, ["--experimental-strip-types", CLI_PATH, "create"], {
      cwd,
      env: { ...process.env, DEEPSEEK_API_KEY: ambient },
      encoding: "utf8",
      timeout: 120_000,
    });
    const stderr = res.stderr ?? "";
    assert.ok(
      !/RT_E_LLM_KEY_SHADOWED/.test(stderr),
      `no .env in the cwd → no conflict signal (the temp-cwd test harness stays keyless):\n${stderr}`,
    );
    assert.equal(JSON.parse(res.stdout).code, "RT_E_VALIDATION");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("W45 331-1 — the CLI resolves .env, carries the provider's credential code, and names the source in the remedy", () => {
  assert.match(cliText, /await installRepoEnvKey\(\);/, "main() must install the .env-resolved key before dispatch");
  assert.match(cliText, /key-resolution\.ts/, "the precedence logic lives in the pure key-resolution module");
  assert.match(
    cliText,
    /typeof res\.code === "string" && res\.code \? \{ code: res\.code \}/,
    "keyed arms must carry the provider's own code (never re-classify prose to RT_E_UNKNOWN)",
  );
  assert.match(
    cliText,
    /code === "RT_E_LLM_KEY_REJECTED" && KEY_SOURCE/,
    "a rejected key's remedy must use the installed source provenance",
  );
  assert.match(cliText, /KEY_SOURCE\.tail/, "the remedy must be tail-only");
  assert.match(cliText, /usage: crewUsage/, "the crew envelope must report measured provider usage");
  assert.ok(!/KEY_SOURCE\.value/.test(cliText), "the secret value must never be read for a remedy");
});

test("W45 331-1 — README documents the precedence and the loud coded conflict", () => {
  assert.match(readmeText, /## API key resolution/, "the precedence rule must be documented");
  assert.match(readmeText, /the `\.env` value WINS when both are present/i);
  assert.match(readmeText, /RT_E_LLM_KEY_SHADOWED/);
  assert.match(readmeText, /RT_E_LLM_KEY_REJECTED/);
});

test("W45 331-1 — a blank process DEEPSEEK_API_KEY disables .env (keyless floor), never a shadow signal", () => {
  const cwd = mkdtempSync(join(tmpdir(), "rapidtool-cli-blankkey-"));
  try {
    const proj = join(cwd, "blank.json");
    const env = { ...process.env, DEEPSEEK_API_KEY: "" };
    const created = spawnSync(
      process.execPath,
      ["--experimental-strip-types", CLI_PATH, "create", "--brief", "A tiny blank-key keyless probe project.", "--name", "BlankKey", "--out", proj],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(created.status, 0, `fixture create failed.\n${created.stdout}\n${created.stderr}`);

    // cwd = the REPO ROOT, where a real .env exists — the blank must still WIN.
    const res = spawnSync(
      process.execPath,
      ["--experimental-strip-types", CLI_PATH, "crew", "--project", proj],
      { cwd: REPO_ROOT, env, encoding: "utf8", timeout: 120_000 },
    );
    const stderr = res.stderr ?? "";
    assert.equal(
      res.status,
      3,
      `a blank key is an intentional DISABLE ⇒ keyless floor (exit 3), never a keyed run.\nstdout: ${res.stdout}\nstderr: ${stderr}`,
    );
    const json = JSON.parse(res.stdout);
    assert.equal(json.ok, false);
    assert.equal(json.code, "RT_E_LLM_NOT_CONFIGURED");
    assert.ok(
      !/RT_E_LLM_KEY_SHADOWED/.test(stderr),
      `a blank key must not consult .env at all (no shadow signal):\n${stderr}`,
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("W46 332-4 (S2) — `create --brief` refuses a bare path CODED and reads `@file` (AW45-c07)", () => {
  const cwd = mkdtempSync(join(tmpdir(), "rapidtool-cli-brief-"));
  try {
    // A corpus-shaped front-matter fixture (research/eval-corpus/*.md shape) and
    // a plain file. The fixture is the AW45-c07 reproduction: pre-fix, the PATH
    // was fed to the lattice and the project named after it.
    writeFileSync(
      join(cwd, "house-flip.md"),
      [
        "---",
        'name: "House-Flipping Manager"',
        'brief: "a house-flipping project manager: budgets, bids, ARV"',
        'expectedNouns: ["flip", "arv"]',
        "---",
        "",
        "## Body",
        "",
      ].join("\n"),
    );
    writeFileSync(join(cwd, "plain.txt"), "A plain brief with no front matter.");
    const run = (argv) =>
      spawnSync(process.execPath, ["--experimental-strip-types", CLI_PATH, ...argv], {
        cwd,
        encoding: "utf8",
        timeout: 120_000,
      });

    // 1. Bare existing-file path → CODED refusal, exit 1, nothing written.
    const bareOut = join(cwd, "bare.json");
    const bare = run(["create", "--brief", "house-flip.md", "--out", bareOut]);
    assert.equal(bare.status, 1, `a bare file path must be refused.\nstdout: ${bare.stdout}\nstderr: ${bare.stderr}`);
    const bareJson = JSON.parse(bare.stdout);
    assert.equal(bareJson.ok, false);
    assert.equal(bareJson.code, "RT_E_VALIDATION");
    assert.match(String(bareJson.error), /names an existing file/);
    assert.match(String(bareJson.error), /--brief @house-flip\.md/, "the refusal names the @file form");
    assert.ok(!existsSync(bareOut), "the refusal must write nothing");

    // 2. `@fixture` → the front-matter `brief:` scalar; the YAML never reaches
    //    the lattice and the project is not named after the path.
    const atOut = join(cwd, "at.json");
    const at = run(["create", "--brief", "@house-flip.md", "--out", atOut]);
    assert.equal(at.status, 0, `@file must read the fixture.\nstdout: ${at.stdout}\nstderr: ${at.stderr}`);
    const atProj = JSON.parse(readFileSync(atOut, "utf8"));
    assert.equal(atProj.brief, "a house-flipping project manager: budgets, bids, ARV");
    assert.ok(!atProj.brief.includes("---"), "front matter must not be fed to the lattice");
    assert.ok(!String(atProj.name).includes("house-flip.md"), "the project is never named after the path");

    // 3. `@plain` → verbatim bytes.
    const plainOut = join(cwd, "plain.json");
    const plain = run(["create", "--brief", "@plain.txt", "--out", plainOut]);
    assert.equal(plain.status, 0, `@file must read a plain file.\nstdout: ${plain.stdout}\nstderr: ${plain.stderr}`);
    assert.equal(JSON.parse(readFileSync(plainOut, "utf8")).brief, "A plain brief with no front matter.");

    // 4. `@missing` → CODED refusal.
    const missing = run(["create", "--brief", "@nope.md", "--out", join(cwd, "nope.json")]);
    assert.equal(missing.status, 1);
    const missingJson = JSON.parse(missing.stdout);
    assert.equal(missingJson.code, "RT_E_VALIDATION");
    assert.match(String(missingJson.error), /does not name a readable file/);

    // 5. The README documents both forms (the doc is part of the contract).
    assert.match(readmeText, /--brief @<path>/, "README-cli.md must document the @file form");
    assert.match(readmeText, /names an existing file|EXISTING, readable file/, "README documents the refusal");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("W46 332-4 (S3) — a valueless value flag is REFUSED coded before dispatch (never a silent default)", () => {
  const cwd = mkdtempSync(join(tmpdir(), "rapidtool-cli-bareflag-"));
  try {
    // Each argv would otherwise succeed (or default) with the flag silently
    // dropped: --limit 5, --steps the seed, --name from the brief, --slug all.
    const cases = [
      { argv: ["search", "--project", "x.json", "--query", "hi", "--limit"], flag: "--limit" },
      { argv: ["wild", "--project", "x.json", "--start", "--steps"], flag: "--steps" },
      { argv: ["create", "--brief", "prose", "--name", "--out", "x.json"], flag: "--name" },
      { argv: ["eval", "--slug"], flag: "--slug" },
    ];
    for (const { argv, flag } of cases) {
      const res = spawnSync(process.execPath, ["--experimental-strip-types", CLI_PATH, ...argv], {
        cwd,
        encoding: "utf8",
        timeout: 120_000,
      });
      assert.equal(
        res.status,
        1,
        `${argv.join(" ")} must refuse a valueless ${flag}.\nstdout: ${res.stdout}\nstderr: ${res.stderr}`,
      );
      const json = JSON.parse(res.stdout);
      assert.equal(json.ok, false);
      assert.equal(json.code, "RT_E_VALIDATION");
      assert.match(String(json.error), new RegExp(`${flag} needs a value`));
      assert.ok(String(json.remedy).includes(`--${flag.slice(2)}`), "the remedy names the flag's value form");
    }
    // The guard is scoped: a Boolean flag stays bare-legal (a bare --help route
    // is asserted elsewhere; here a bare --advisory must not trip the guard).
    const advisory = spawnSync(
      process.execPath,
      ["--experimental-strip-types", CLI_PATH, "create", "--brief", "An advisory bare-flag probe project.", "--advisory", "--out", join(cwd, "adv.json")],
      { cwd, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(advisory.status, 0, `a bare boolean flag must stay legal.\nstdout: ${advisory.stdout}\nstderr: ${advisory.stderr}`);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

/**
 * W48 · 334-4 (S2) introduced exit 5 for a green tree whose declared scripts
 * never ran; W49 · 335-4 made that strict exit OPT-IN (`--require-verified`).
 * A fresh tree has no `node_modules/`, so its toolchain is ALWAYS unverified —
 * a default that never exits 0 is not a usable pass/fail. The DEFAULT is now
 * exit 0 and the honest signal rides the envelope (`unverified`,
 * `declaredScriptsVerified`, `unverifiedDeclaredScripts`); `--require-verified`
 * restores the strict exit 5. `tree-run` carries the same contract.
 */
test("W49 · 335-4: emit --run / tree-run default to exit 0 on a green-but-unverified tree; --require-verified opts into exit 5", () => {
  const cwd = mkdtempSync(join(tmpdir(), "rapidtool-cli-unverified-"));
  const env = { ...process.env };
  for (const key of ["DEEPSEEK_API_KEY", "RT_HUMAN_SEAT_TOKEN", "RAPIDTOOL_ACTOR", "RAPIDTOOL_LOG_DIR"]) {
    delete env[key];
  }
  const BRIEF =
    "A small internal tool that reconciles invoice line items for a three-person accounting team.";
  try {
    const proj = join(cwd, "unverified.json");
    const created = spawnSync(
      process.execPath,
      ["--experimental-strip-types", CLI_PATH, "create", "--brief", BRIEF, "--name", "Unverified", "--out", proj],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(created.status, 0, `fixture create failed.\nstdout: ${created.stdout}\nstderr: ${created.stderr}`);

    const tree = join(cwd, "tree");
    const ran = spawnSync(
      process.execPath,
      ["--experimental-strip-types", CLI_PATH, "emit", "--project", proj, "--out", tree, "--run"],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(
      ran.status,
      0,
      `a green tree defaults to exit 0 (the envelope names the unverified toolchain); red is 1.\nstdout: ${ran.stdout}\nstderr: ${ran.stderr}`,
    );
    const envelope = JSON.parse(ran.stdout);
    assert.equal(envelope.ok, true, "`ok` is NOT redefined — nothing ran red");
    assert.equal(envelope.code, undefined, "an unverified-but-green tree is not an error class");
    assert.equal(envelope.declaredScriptsVerified, false, "the envelope names the unverified toolchain");
    assert.equal(envelope.unverified, true);
    assert.ok(
      Array.isArray(envelope.unverifiedDeclaredScripts) && envelope.unverifiedDeclaredScripts.includes("typecheck"),
      `unverifiedDeclaredScripts must name typecheck, saw ${JSON.stringify(envelope.unverifiedDeclaredScripts)}`,
    );
    assert.equal(
      envelope.unverifiedDeclaredScripts.includes("build"),
      true,
      "the declared build script is unverified too",
    );
    assert.match(String(envelope.unverifiedNote), /UNVERIFIED/);
    // The embedded verdict carries the same truth (one source, not a second copy).
    assert.equal(envelope.treeRun.ok, true);
    assert.deepEqual(envelope.treeRun.unverifiedDeclaredScripts, envelope.unverifiedDeclaredScripts);

    // --require-verified opts INTO the strict exit 5 for the same state.
    const strict = spawnSync(
      process.execPath,
      ["--experimental-strip-types", CLI_PATH, "emit", "--project", proj, "--out", tree, "--run", "--require-verified"],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(
      strict.status,
      5,
      `--require-verified must turn the green-but-unverified state into exit 5.\nstdout: ${strict.stdout}\nstderr: ${strict.stderr}`,
    );
    const strictEnv = JSON.parse(strict.stdout);
    assert.equal(strictEnv.ok, true, "the strict exit is not an error class — `ok` stays true");
    assert.equal(strictEnv.code, undefined, "no RT_E code rides the strict exit");
    assert.equal(strictEnv.unverified, true);

    // tree-run carries the same default + opt-in strict contract.
    const trDefault = spawnSync(
      process.execPath,
      ["--experimental-strip-types", CLI_PATH, "tree-run", "--dir", tree],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(
      trDefault.status,
      0,
      `tree-run on the same unverified tree must default to exit 0.\nstdout: ${trDefault.stdout}\nstderr: ${trDefault.stderr}`,
    );
    const trStrict = spawnSync(
      process.execPath,
      ["--experimental-strip-types", CLI_PATH, "tree-run", "--dir", tree, "--require-verified"],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(
      trStrict.status,
      5,
      `tree-run --require-verified must exit 5 on the green-but-unverified tree.\nstdout: ${trStrict.stdout}\nstderr: ${trStrict.stderr}`,
    );

    // README-cli.md documents the class and the envelope contract.
    assert.match(readmeText, /Exit 5/, "README-cli.md must document exit 5");
    assert.match(readmeText, /--require-verified/, "README-cli.md must document the opt-in strict flag");
    assert.match(readmeText, /unverifiedDeclaredScripts/, "README-cli.md must name the envelope field");
    assert.match(readmeText, /declaredScriptsVerified: false/, "README-cli.md must name the verified flag");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
