#!/usr/bin/env node
// ---------------------------------------------------------------------------
// rapidtool-cli.mjs — thin argv wrapper over src/lib/headless.ts.
//
// Drive a RapidTool project with NO browser, NO server, NO Vite — just files.
// Every subcommand prints a single JSON object to stdout (parseable by an AI
// agent) and exits with a machine-readable exit code (E-25 taxonomy — see
// scripts/README-cli.md "Exit codes"). Failure envelopes additionally carry
// `code` — a stable RT_E_* id produced by classifyError (src/lib/errors.ts,
// see scripts/README-cli.md "Error codes (RT_E_*)").
//
// Run (Node 22, requires --experimental-strip-types to import the .ts driver):
//
//   node --experimental-strip-types scripts/rapidtool-cli.mjs --help        # the synopsis as a SUCCESS (ok:true, exit 0); `--help <verb>` narrows to one verb; `help` / `-h` are the same
//   node --experimental-strip-types scripts/rapidtool-cli.mjs create --brief "..." --name "..." --out build.json
//   node --experimental-strip-types scripts/rapidtool-cli.mjs create --brief @brief.md --out build.json   # @file = read the file (a corpus fixture's `brief:` front-matter scalar is unwrapped); a bare existing-file path is REFUSED, never fed to the lattice as prose
//   node --experimental-strip-types scripts/rapidtool-cli.mjs run     --project build.json [--live]
//   node --experimental-strip-types scripts/rapidtool-cli.mjs gate    --project build.json [--autopilot] [--live]
//   node --experimental-strip-types scripts/rapidtool-cli.mjs resume    --project build.json [--autopilot] [--live]   # T-107.7: re-enter from the per-phase checkpoint (prints the snapshot age; never a silent resume)
//   node --experimental-strip-types scripts/rapidtool-cli.mjs unattended --project build.json                         # W-47: scheduler-facing drive — resumes from a checkpoint when present, else starts from the file; autopilot + live; a stock HITL gate whose DoD passes is cleared through the ledgered machine actor (`approve --seat autopilot`), so only a forceHuman gate (or any red DoD gate) still parks (exit 2)
//   node --experimental-strip-types scripts/rapidtool-cli.mjs approve --project build.json (--i-am-human | --seat autopilot) [--force]   # the seat is never guessed (314 F5 / K2)
//   node --experimental-strip-types scripts/rapidtool-cli.mjs reject  --project build.json --note "..."
//   node --experimental-strip-types scripts/rapidtool-cli.mjs retry   --project build.json                  # unlock a rejected/blocked phase
//   node --experimental-strip-types scripts/rapidtool-cli.mjs ingest  --project build.json --report '@report.json' | '-'
//   node --experimental-strip-types scripts/rapidtool-cli.mjs packet  --project build.json [--out packet.md]
//   node --experimental-strip-types scripts/rapidtool-cli.mjs export  --project build.json [--out out.json]
//   node --experimental-strip-types scripts/rapidtool-cli.mjs vault   --project build.json [--out <dir>]      # default: <home>/RapidTool Software/<slug>/vault
//   node --experimental-strip-types scripts/rapidtool-cli.mjs emit    --project build.json [--out <dir>] [--check] [--run] [--require-verified]   # default: <home>/RapidTool Software/<slug>/; --check = per-file compile verdicts; --run = compile + tests + entry smoke (TreeRunOutcome); a green tree whose declared typecheck/build never ran still exits 0 and echoes `unverified` — --require-verified makes that state exit 5
//   node --experimental-strip-types scripts/rapidtool-cli.mjs tree-run --dir <dir> [--project build.json] [--require-verified]                  # fixes/149 P0-1: compile-check treeRun over an EXISTING emitted dir — read-only, never re-emits, never clobbers (exit 1 on red with the first not-ok tail; --require-verified makes a green-but-unverified toolchain exit 5); --project adds the hash-checked dirDirty divergence report
//   node --experimental-strip-types scripts/rapidtool-cli.mjs repair  --dir <dir> --project build.json [--budget N]        # fixes/149 P0-1: hash-checked dir→ledger re-import + bounded repair cycle against the dir (treeRun → red tail → synthesis w/ deps.treeFailure → apply → re-import → treeRun); green → tested-mint + converged (exit 0); budget exhausted → honest failed (exit 1, RT_E_REPAIR_FAILED)
//   node --experimental-strip-types scripts/rapidtool-cli.mjs edit    --dir <dir> --file <relpath> --find "<old>" --replace "<new>" [--write] [--project build.json]   # 216s (108-T1): in-place str_replace on ONE emitted tree file — DRY-RUN by default (the diff + would-be hashes are returned, NOTHING is written); --write (requires --project) applies atomically only after evaluatePolicy("repair.apply", tree:<dir>) allows the seat, then lands ONE attributed ledger row (actor + decidedVia provenance + patch + before/after hashes)
//   node --experimental-strip-types scripts/rapidtool-cli.mjs search  --project build.json --query "..." [--limit N]
//   node --experimental-strip-types scripts/rapidtool-cli.mjs crew    --project build.json [--max-steps N]
//   node --experimental-strip-types scripts/rapidtool-cli.mjs verify  --project build.json [--apply]
//   node --experimental-strip-types scripts/rapidtool-cli.mjs design   --project build.json [--html design.html]
//   node --experimental-strip-types scripts/rapidtool-cli.mjs diagram  --project build.json --kind phases|architecture|flow [--out out.svg]
//   node --experimental-strip-types scripts/rapidtool-cli.mjs artifacts --project build.json
//   node --experimental-strip-types scripts/rapidtool-cli.mjs doctor
//   node --experimental-strip-types scripts/rapidtool-cli.mjs harvest --project build.json
//   node --experimental-strip-types scripts/rapidtool-cli.mjs swarm   --project build.json
//   node --experimental-strip-types scripts/rapidtool-cli.mjs prompt  --project build.json [--policies a,b]
//   node --experimental-strip-types scripts/rapidtool-cli.mjs bench   --project build.json
//   node --experimental-strip-types scripts/rapidtool-cli.mjs mine    --dir src/lib [--limit 200]
//   node --experimental-strip-types scripts/rapidtool-cli.mjs knowledge --store patterns.json --save '{"project":"p","kind":"pattern","title":"…","tags":["a"],"body":"…"}'
//   node --experimental-strip-types scripts/rapidtool-cli.mjs knowledge --store patterns.json --find "auth refresh" [--limit 5]
//   node --experimental-strip-types scripts/rapidtool-cli.mjs wild    --project build.json [--start|--pause|--resume|--stop] [--steps 24] [--agent-seal]  # --start enables + begins a run; default steps an active run; --agent-seal = the sealed unattended policy (the ONLY verb that accepts it — approve/gate/run/resume/unattended REFUSE it, RT_E_VALIDATION)
//   node --experimental-strip-types scripts/rapidtool-cli.mjs chat    --project build.json --ask "..." [--history '[{"role":"user","text":"..."}]']   # grounded copilot turn (needs DEEPSEEK_API_KEY)
//   node --experimental-strip-types scripts/rapidtool-cli.mjs deepen  --project build.json [--phase 7]     # re-run live research over a completed research phase (0/7/11)
//   node --experimental-strip-types scripts/rapidtool-cli.mjs lesson  --list --project build.json [--brief "…"] [--limit N]     # read-only: the project's lesson rows (kind/class/phase/score/evidence); --brief ranks via topLessonRows (fusionRank), else score-desc
//   node --experimental-strip-types scripts/rapidtool-cli.mjs lesson  --propose --brief "raw evidence…" [--project NAME] [--kind fix|pattern|note] [--tags a,b] [--title "…"]   # bounded flash DRAFT (never writes; keyed: one DeepSeek turn; keyless: labeled deterministic draft)
//   node --experimental-strip-types scripts/rapidtool-cli.mjs lesson  --accept --project build.json --out lessons.json [--actor NAME] [--limit N]  # THE human-gated cross-project lesson write (top FusionRank rows → knowledge store)
//   node --experimental-strip-types scripts/rapidtool-cli.mjs lesson  --supersede --knowledge-file lessons.json --id K1a2b3c4d [--evidence "…"]  # append-only supersede (new row + markSuperseded)
//   node --experimental-strip-types scripts/rapidtool-cli.mjs lesson  --refute --knowledge-file lessons.json --id K1a2b3c4d [--evidence "…"]   # counter-evidence bump (decay/retire)
//   node --experimental-strip-types scripts/rapidtool-cli.mjs lesson  --advise (--project build.json | --knowledge-file lessons.json) [--brief "…"] [--phase N] [--limit N]   # 216s (112 T5): read-only pre-flight — ranked FAIL-class lesson rows (fusionRank vs --brief, else score-desc) with the live telemetry the rows actually carry (reproducedCount / counterEvidence)
//   node --experimental-strip-types scripts/rapidtool-cli.mjs lesson  --verify (--knowledge-file lessons.json | --project build.json) --anchor <path> [--mark-stale] [--limit N]   # 216s (112 T5): re-hash the anchor's current bytes against each row's recorded evidenceHash= token → ok | stale | anchor-missing; READ-ONLY unless --mark-stale (store counterEvidence telemetry only, never content)
//   node --experimental-strip-types scripts/rapidtool-cli.mjs lesson  --effect --project build.json   # F3 (221 §F3): read-only cross-run learning MEASUREMENT — recurrence census of the project's lesson rows (reproduced/unreproduced, per-class rates, per-row evidence with the lesson.reproduced ledger rows that accrued it); recurrence ≠ causation label + census window + n≥2 "baseline only" floor ride inside the JSON
//   node --experimental-strip-types scripts/rapidtool-cli.mjs packet  --project build.json [--knowledge lessons.json]        # tier-1: seed Ranked memory with accepted cross-project lessons
//   node --experimental-strip-types scripts/rapidtool-cli.mjs eval    [--dir research/eval-out] [--slug <slug>]              # T5.3 (262 LANE 5): read-only M1-M9 eval scorecard + history deltas from the eval-out documents — no keyed calls, no writes
// ---------------------------------------------------------------------------
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync, writeSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import readline from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";
// R11-f07: the ONE shared physical-containment helper (scripts/path-safety.mjs)
// — used by the `edit` verb below so a symlinked parent cannot escape --dir.
import { physicalInside } from "./path-safety.mjs";

// E-25: every result object carries schema_version + cmd + exit_code.
const SCHEMA_VERSION = 1;
let CMD = null;

// ---------------------------------------------------------------------------
// Arg parsing (--flag value | --flag=value, plus bare boolean flags).
// ---------------------------------------------------------------------------
/** @returns {{ _: string[]; [key: string]: string | boolean | string[] }} */
function parseArgs(argv) {
  /** @type {{ _: string[]; [key: string]: string | boolean | string[] }} */
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--") {
      args._.push(...argv.slice(i + 1));
      break;
    }
    if (token.startsWith("--")) {
      const eq = token.indexOf("=");
      if (eq !== -1) {
        args[token.slice(2, eq)] = token.slice(eq + 1);
      } else {
        const key = token.slice(2);
        const next = argv[i + 1];
        // Boolean flag: next token is another flag, or there is no next token.
        if (next === undefined || next.startsWith("--")) {
          args[key] = true;
        } else {
          args[key] = next;
          i += 1;
        }
      }
    } else {
      args._.push(token);
    }
  }
  return args;
}

function requireArg(args, key, cmd) {
  const v = args[key];
  if (typeof v !== "string" || v.trim() === "") {
    return { error: `${cmd}: missing required --${key}` };
  }
  return { value: v };
}

function flag(args, key) {
  return args[key] === true || args[key] === "true" || args[key] === "1";
}

// W44 A5 (bug-hunter · scripts box): R5-f10 refused a VALUELESS path flag
// (`--out` stored as `true`); the EMPTY-VALUE spelling (`--out=`, `--out ""`)
// still melted through the `typeof args.out === "string"` reads into
// `resolve("")` — the CWD. Reproduced keyless (C:/Users/mnril/a5_scratch/p1):
// `emit --out=` exited 0 with 15 files silently emitted INTO the cwd;
// `vault --out=` exited 0 with 17 vault files in the cwd; `packet --out=`
// exited 4 opening the cwd as a file (EISDIR); `create --out=` exited 4
// renaming onto the cwd dir (EPERM). A path-valued flag needs a NON-EMPTY
// value: both spellings refuse in the SAME validation class (exit 1,
// RT_E_VALIDATION), nothing written.
function pathFlagMissing(v) {
  return v === true || (typeof v === "string" && v.trim() === "");
}

/** The refusal text for a missing/empty path-flag value (pathFlagMissing). */
function pathFlagRefusalError(cmd, key, v) {
  return `${cmd} --${key} requires a path (got ${v === true ? "a flag with no value" : "an empty value"})`;
}

// 316 H3 (315 V2 finding #4): the agent seal (`--agent-seal`) is a WILD-RUN
// concept — it lives in the wild step's options and only the `wild` verb
// threads it into effect. parseArgs absorbs ANY `--flag`, so the drive verbs
// used to swallow it silently (a governance flag a caller could believe had
// applied, when it never could). ONE coded pointer refusal, reused by every
// arm whose driver can never carry the seal — name the flag, the code, and
// the ONE door that does carry it.
function refuseAgentSeal(cmdName) {
  return respond(
    {
      ok: false,
      error: `${cmdName}: --agent-seal does not apply here — the agent seal is a WILD-RUN concept (it opts the wild loop's classifier-as-approver policy into effect; coded [seat agent-seal] rows) and this verb's driver can never carry it.`,
      code: "RT_E_VALIDATION",
      remedy:
        "The seal is a wild-run concept: use `wild --start --agent-seal` (or `wild --resume --agent-seal` for an active run) — the only verb that threads it into the wild loop; drop the flag here.",
    },
    1,
  );
}

// S3 (W46 · 332-4): the value-taking flags whose valueless spelling was still
// silently absorbed. parseArgs turns `--x` with no value into `true`; every flag
// here was then dropped by a `typeof args.x === "string"` read that fell back to
// a default (--limit 5, --phase null, --steps the seed, …) or by a raw read.
// The 330/331 waves fixed --knowledge/--agent-seal one at a time; this ONE
// pre-dispatch refusal covers the rest, so a value flag is never silently
// ignored. Boolean flags are deliberately absent (--live/--apply/--force/...);
// the path flags --out/--knowledge/--html keep their own per-site
// pathFlagRefusalError text, pinned by cli-exit-taxonomy.test.mjs.
const VALUELESS_VALUE_FLAGS = [
  "name",
  "limit",
  "phase",
  "steps",
  "max-steps",
  "budget",
  "tags",
  "title",
  "kind",
  "actor",
  "evidence",
  "reason",
  "by",
  "slug",
  "dir",
  "history",
  "policies",
  "ids",
  "tree",
];

/** Refuse a value flag parsed valueless, before ANY verb dispatch. */
function refuseValuelessFlag(cmdName, key) {
  return respond(
    {
      ok: false,
      error: `${cmdName}: --${key} needs a value — it parsed as a flag with no value, so it would have been silently ignored.`,
      code: "RT_E_VALIDATION",
      remedy: `Pass the value (--${key} <value> or --${key}=<value>), or drop the flag if you did not mean to set it.`,
    },
    1,
  );
}

// W49 · 335-4 (Switchboard): the documented NUMERIC flags, whose non-numeric
// value was still silently DROPPED (the class the valueless guard above leaves
// open). Probed live before the fix: `search --limit abc` exited 0 with the
// default limit, and `deepen --phase abc` fell back to the LIVE phase, so the
// refusal that came back read "P0 is not complete" — the caller's actual
// mistake (a non-numeric --phase) was never named. Refused pre-dispatch, like
// the valueless spelling.
const NUMERIC_VALUE_FLAGS = ["limit", "phase", "steps", "max-steps", "budget"];

/** Refuse a documented numeric flag whose value is not a non-negative integer. */
function refuseNonNumericFlag(cmdName, key, value) {
  return respond(
    {
      ok: false,
      error: `${cmdName}: --${key} expects a non-negative integer (got ${JSON.stringify(value)}).`,
      code: "RT_E_VALIDATION",
      remedy: `Pass an integer (--${key} <n>), or drop the flag if you did not mean to set it.`,
    },
    1,
  );
}

// W49 · 335-4 (Switchboard): an agent driving the CLI blind branches on
// `remedy`, so a self-inflicted USAGE error must carry the concrete fix. The
// registry's RT_E_VALIDATION agentAction is written for the ENGINE validating
// model output ("Reject the payload … ask for corrected input"), the wrong
// voice for a mistyped flag. Every shape below is constructed by THIS file's
// own argument guards, so the translation is deterministic — non-usage
// validation prose returns null and keeps the registry action. The flag-naming
// fallback covers the per-verb value guards (--red-tree / --kind / --tree / …)
// whose `error` already states the accepted values.
function usageRemedy(error) {
  if (typeof error !== "string") return null;
  let m;
  m = /^([\w-]+(?: [\w-]+)*): missing required --([\w-]+)$/.exec(error);
  if (m) {
    const verb = m[1].split(" ")[0];
    return `Re-run with --${m[2]}: \`${m[1]} --${m[2]} <value>\`. Run \`--help ${verb}\` for the verb's synopsis.`;
  }
  m = /^([\w-]+) --([\w-]+) requires a path /.exec(error);
  if (m) return `Pass a non-empty path: --${m[2]} <path> (an empty value would resolve to the CWD).`;
  m = /^Unknown subcommand: (.+)$/.exec(error);
  if (m) return `"${m[1]}" is not a verb — run \`--help\` for the 39-verb synopsis, then check the spelling.`;
  if (/^Missing subcommand\./.test(error)) {
    return "Pass a verb, e.g. `create --brief <text> --out build.json`; run `--help` for the full synopsis or `--help <verb>` for one verb.";
  }
  m = /^([\w-]+(?: [\w-]+)*): pass exactly one of /.exec(error);
  if (m) return `Pass exactly ONE action flag (the message lists them); e.g. \`${m[1].split(" ")[0]} --list\`.`;
  if (/^([\w-]+(?: [\w-]+)*): pass at most one of /.test(error)) {
    return "Pass at most ONE flag from the list (or none for the default action).";
  }
  if (/--[a-z]/.test(error)) {
    return `Fix the value named in \`error\` and re-run; \`--help ${CMD ?? "<verb>"}\` lists the accepted flags.`;
  }
  return null;
}

// E-25: single JSON object on stdout + the machine exit code. Every result
// gains schema_version/cmd/exit_code; the legacy `ok` field is kept. Every
// {ok:false} envelope additionally gains `code` — a stable RT_E_* id from
// classifyError (src/lib/errors.ts) — additive, exit-code taxonomy unchanged.
// Sites that already set their own `code` pass through untouched.
//
// fixes/217e (G1): SYNCHRONOUS by construction. The NDJSON stamp below runs
// synchronously (cliLogEvent's body is fs-sync) and process.exit() executes in
// the same tick as the stdout write. The former `await cliLogEvent(...)`
// deferred the exit behind a resumed event-loop turn, so a guard-position
// `return respond(...)` still fell through to the verb's success path and
// crashed with a TypeError (observed 3/3 in 216y §2.3 G1). No caller awaits
// respond — the synchronous exit is behaviour-identical on the success path,
// and it is what makes a handled refusal actually END the verb.
/** @returns {never} the in-tick process.exit below never returns (fixes/217e G1). */
function respond(result, exitCode) {
  const out = { schema_version: SCHEMA_VERSION, cmd: CMD ?? null, ...result };
  if (out.ok === false && typeof out.code === "undefined") {
    // Exit 3 is the taxonomy's "backend not configured" (crew/verify); the
    // prose classifier cannot know that domain, so pin the not-configured code.
    if (exitCode === 3) {
      out.code = "RT_E_LLM_NOT_CONFIGURED";
    } else {
      const text =
        typeof out.error === "string"
          ? out.error
          : typeof out.reason === "string"
            ? out.reason
            : "";
      const code = classify(text);
      if (code) out.code = code; // else omit (errors.ts absent — resilience)
    }
  }
  // fixes/312_c6_ux (U3 · K5/K6): a coded refusal self-explains — attach the
  // registry's own agentAction as `remedy` (a call site's own remedy passes
  // through untouched). Omitted exactly when `code` is (doc absent / unknown).
  if (out.ok === false && typeof out.remedy === "undefined") {
    // W49 · 335-4: a CLI usage refusal gets the CLI's own fix, not the
    // registry's engine-voiced RT_E_VALIDATION action; every other code keeps
    // the registry action (usageRemedy returns null for non-usage prose).
    const remedy = (out.code === "RT_E_VALIDATION" ? usageRemedy(out.error) : null) ?? remedyFor(out.code);
    if (remedy) out.remedy = remedy;
  }
  out.exit_code = exitCode;
  // G/E: stamp every CLI exit into the headless NDJSON event log (best-effort
  // — the appender itself must never break the exit path). NOT awaited
  // (fixes/217e G1): the append is fs-sync, and an await here deferred the
  // exit one event-loop turn — the fall-through the audit reproduced.
  try {
    if (typeof cliLogEvent === "function") {
      cliLogEvent({
        // fixes/323 FIX-2c (window #4 item 3 · F-3): exit 2 is the taxonomy's
        // PARK (awaiting_hitl / blocked) — the honest outcome, never a failure
        // (README-cli §Agent contract). It logs at `warn` with an explicit
        // `parked` payload tag; only true failures (exit 1/3/4) log `error`.
        // No RT_E code rides a clean park: codes are for surfaced FAILURES
        // (AGENTS.md honesty contract #4), and the envelope deliberately omits
        // `code` on a clean park — the tag is the park marker, not a fake code.
        level: exitCode === 0 ? "info" : exitCode === 2 ? "warn" : "error",
        scope: "cli-command",
        // OPS-4 (K13, W40 N5): emit the CATALOGUED name. The old free-form
        // `cli.<cmd>.ok|exit` strings are in no registry (RT_EVENT_NAMES has
        // only cli.invocation/cli.error on this scope) and the catalogued
        // cli.invocation was never emitted — the verb + outcome now ride the
        // payload instead of an invented event name.
        event: "cli.invocation",
        message:
          out.ok === false && typeof out.error === "string"
            ? out.error.slice(0, 200)
            : `${CMD ?? "command"} exit ${exitCode}`,
        code: typeof out.code === "string" ? out.code : undefined,
        payload: { cmd: CMD ?? null, exitCode, ...(exitCode === 2 ? { parked: true } : {}) },
      });
    }
  } catch {
    /* never break the exit path */
  }
  // fixes/297 R1 (Q2 row-4 of the §A2 walk): piped stdout on Windows is an
  // ASYNC libuv write (Node docs — "Pipes: asynchronous on Windows"), and the
  // in-tick process.exit() below can cut a large envelope before the pipe
  // consumed it. Drain synchronously to fd 1 FIRST so nothing is left buffered
  // when the exit runs; the exit itself stays in-tick (fixes/217e G1 — the
  // guard-position call sites depend on respond ENDING the verb, so deferring
  // the exit through the event loop would re-open that fall-through).
  const payload = JSON.stringify(out, null, 2) + "\n";
  try {
    writeSync(1, payload);
  } catch {
    // fd 1 unusable (closed/EBADF/EAGAIN): keep the async write as last
    // resort — identical to the pre-fix path, worst case unchanged.
    process.stdout.write(payload);
  }
  process.exit(exitCode);
}

// ---------------------------------------------------------------------------
// Error-code classifier (optional sibling: src/lib/errors.ts). Lazy, memoized,
// never-throw — same pathToFileURL mechanics as DRIVER_PATH below. If the
// module is absent every command still works; failures simply omit `code`.
// Two entry points: `classify(text)` for prose envelopes (respond()'s
// fallback) and `classifyErr(err, fallback)` for the ERROR OBJECT at catch
// sites — name/errno/.code matching only fires on the object, never on prose.
// ---------------------------------------------------------------------------
/** @type {(text: string) => string | null} */
let classify = () => null; // prose classifier — omit `code` when module absent
/** @type {(err: unknown, fallback?: string) => string | null} */
let classifyErr = () => null; // object classifier (same module)
// fixes/312_c6_ux (U3 · K5/K6): ERROR_CODE_DOC once errors.ts loads — the
// module-level handle respond() (SYNC by construction, fixes/217e G1) reads
// its coded remedies from. Null until ensureErrorCodes() resolves; a remedy
// simply omits then, mirroring `code`'s best-effort contract.
let errorDoc = null;
let errorCodesLoaded = false;
async function ensureErrorCodes() {
  if (errorCodesLoaded) return;
  errorCodesLoaded = true;
  try {
    const mod = await import(
      pathToFileURL(
        join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "errors.ts"),
      ).href,
    );
    if (typeof mod.classifyError === "function") {
      const fn = mod.classifyError;
      // OPS-13 (W42 · L4/G8): when the errors module ships its own registry
      // (ERROR_CODE_DOC), a shape-valid code that is NOT in the registry must
      // not ride an envelope — `code in doc` is the contract. Doc-absent
      // (module absent / older errors.ts) keeps the legacy shape-only rule.
      const doc =
        mod.ERROR_CODE_DOC && typeof mod.ERROR_CODE_DOC === "object" ? mod.ERROR_CODE_DOC : null;
      errorDoc = doc; // U3 (fixes/312_c6_ux): respond() ships coded remedies from this registry
      const safe = (code) =>
        typeof code === "string" &&
        /^RT_E_[A-Z0-9_]+$/.test(code) &&
        (doc === null || code in doc)
          ? code
          : null;
      classify = (text) => {
        try {
          return safe(fn(text));
        } catch {
          return null;
        }
      };
      classifyErr = (err, fallback) => {
        try {
          return safe(fn(err, fallback));
        } catch {
          return null;
        }
      };
    }
  } catch {
    // errors.ts absent — respond() omits `code`; the CLI stays fully functional.
  }
}

// Spread-helper: `{ code }` when the object classifier produced one, `{}`
// when it didn't — so respond()'s prose fallback still applies (and, when
// errors.ts is absent, the `code` key is omitted entirely as before).
function errCode(err, fallback) {
  const c = classifyErr(err, fallback);
  return c ? { code: c } : {};
}

// U3 (fixes/312_c6_ux · 311_sd_product K5/K6): the coded remedy seam — the
// registry's OWN `agentAction` line, shipped as `remedy` on coded refusals so
// an agent's next step is IN the envelope instead of behind a docs hop
// (`diagnose` already surfaces these; the CLI never shipped them). Same
// best-effort contract as `code`: doc absent / unknown code / empty text →
// the key is omitted and the envelope stays byte-identical to before.
function remedyFor(code) {
  if (typeof code !== "string" || code.length === 0) return null;
  // W45·331-1 (Keywright): a rejected credential's remedy NAMES the source the
  // key came from (repo .env path or process env) by tail only — the static
  // registry action line cannot carry that provenance.
  if (code === "RT_E_LLM_KEY_REJECTED" && KEY_SOURCE) {
    const where = KEY_SOURCE.kind === "repo-env-file" ? KEY_SOURCE.path : "the process environment";
    const also = KEY_SOURCE.conflict
      ? ` A conflicting process-environment key (tail …${KEY_SOURCE.conflict.processEnvTail}) was ignored: the repo .env key wins by documented precedence.`
      : "";
    return (
      `The provider rejected the key from ${where} (tail …${KEY_SOURCE.tail}). Replace/refresh that key, ` +
      `confirm the source precedence (scripts/README-cli.md "API key resolution"), and never paste the full key into logs.${also}`
    );
  }
  if (errorDoc === null) return null;
  const entry = errorDoc[code];
  const text = entry && typeof entry.agentAction === "string" ? entry.agentAction.trim() : "";
  return text.length > 0 ? text : null;
}

// ---------------------------------------------------------------------------
// Load the headless driver (dynamic import of the .ts — needs strip-types).
// Path is resolved against this script's own location (cwd-independent).
// ---------------------------------------------------------------------------
const DRIVER_PATH = pathToFileURL(
  join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "headless.ts"),
).href;

let headless = null;
async function driver() {
  if (!headless) headless = await import(DRIVER_PATH);
  return headless;
}

// ---------------------------------------------------------------------------
// 342-5: the doctor surface (src/lib/doctor.ts) — its `doctorMcp` reports the
// owner-gated MCP client honestly. Same lazy .ts import mechanics as the driver.
// ---------------------------------------------------------------------------
const DOCTOR_PATH = pathToFileURL(
  join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "doctor.ts"),
).href;

let doctorModule = null;
async function doctorDriver() {
  if (!doctorModule) doctorModule = await import(DOCTOR_PATH);
  return doctorModule;
}

// ---------------------------------------------------------------------------
// Load the compile-check seam (src/lib/compile-check.server.ts, same lazy
// .ts import mechanics as the driver — fixes/132 C2 `check` verb + emit
// `--check`).
// ---------------------------------------------------------------------------
const CHECK_PATH = pathToFileURL(
  join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "compile-check.server.ts"),
).href;

let compileCheck = null;
async function checkDriver() {
  if (!compileCheck) compileCheck = await import(CHECK_PATH);
  return compileCheck;
}

// ---------------------------------------------------------------------------
// R11-f08 (W42 · L4/E4): the forced-emit quarantine-move seam
// (src/lib/quarantine.ts, same lazy .ts import mechanics as the driver). The
// `emit` arm calls this AFTER an ok emit that returned `survivors` — the
// foreign files are MOVED ASIDE (recoverable, never a delete) instead of
// being left in place, so a later tree-run never judges bytes the factory
// never authored. The full lift INTO emitProject stays deferred (headless.ts
// is its own window); the CLI-side seam is the safe placement (fixes/272 §[2]).
// ---------------------------------------------------------------------------
const QUARANTINE_PATH = pathToFileURL(
  join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "quarantine.ts"),
).href;

let quarantineModule = null;
async function quarantineDriver() {
  if (!quarantineModule) quarantineModule = await import(QUARANTINE_PATH);
  return quarantineModule;
}

// ---------------------------------------------------------------------------
// T-107.7 (W33 lane L2): the run-checkpoint seam (src/lib/checkpoint.server.ts)
// — the read/admission side of the per-phase commit checkpoint that
// `headless.runUntilGate` writes beside `.rapidtool/`.
// W36 N2: the `resume`/`unattended` verbs consume the headless seam instead
// (headless.loadResumableCheckpoint = read→admit→hydrate in ONE place, so the
// read-side law is not re-derived here).
// W39 Z1: the direct lazy loader (CHECKPOINT_PATH / checkpointServer /
// checkpointDriver) was REMOVED here — it never gained a consumer after N2
// rerouted resume through the headless seam, and the 0-warning gate forbids
// dead code. Reintroduce it (same lazy .ts mechanics as the scorecard driver
// below) if a read-only CLI use lands, e.g. a `resume --list`.
// W40 N5 (K7 item 9): the predicted read-only consumer landed — `diagnose`
// surfaces `checkpoint: {present, path, savedAt}` through this loader. Read
// ONLY: never admits, never hydrates, never writes.
// ---------------------------------------------------------------------------
const CHECKPOINT_PATH = pathToFileURL(
  join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "checkpoint.server.ts"),
).href;

let checkpointServer = null;
async function checkpointDriver() {
  if (!checkpointServer) checkpointServer = await import(CHECKPOINT_PATH);
  return checkpointServer;
}

// ---------------------------------------------------------------------------
// T5.3 (fixes/262 LANE 5 · W23): the eval scorecard reader
// (src/lib/scorecard.ts — PURE: it parses the eval-out documents and builds the
// printable scorecard; THIS verb owns the fs reads, so the module stays
// client-safe per AGENTS.md's "never import node:fs into client-safe modules").
// Same lazy .ts mechanics as the driver. `eval` also honors $EVAL_OUT_DIR
// exactly like scripts/run-eval.mjs does, so a scratch run's out-dir can be
// read back with the same env var that produced it (`--dir` overrides both).
// ---------------------------------------------------------------------------
const SCORECARD_PATH = pathToFileURL(
  join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "scorecard.ts"),
).href;
/** Default eval-out dir: <repo>/research/eval-out (run-eval.mjs's own default). */
const EVAL_OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "research", "eval-out");

let scorecardMod = null;
async function scorecardDriver() {
  if (!scorecardMod) scorecardMod = await import(SCORECARD_PATH);
  return scorecardMod;
}

// ---------------------------------------------------------------------------
// Load the cross-project knowledge store (src/lib/knowledge.ts, same lazy .ts
// mechanics — server-side only: the module statically imports node:fs) and the
// packet compiler (src/lib/packet.ts, pure) for the tier-1 `packet
// --knowledge` seam (fixes/144 M5-3/4). Neither is imported unless a lesson
// action or --knowledge runs, so the CLI's plain paths stay untouched.
// ---------------------------------------------------------------------------
const KNOWLEDGE_PATH = pathToFileURL(
  join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "knowledge.ts"),
).href;
const PACKET_PATH = pathToFileURL(
  join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "packet.ts"),
).href;

let knowledgeMod = null;
let packetMod = null;
async function knowledgeDriver() {
  if (!knowledgeMod) knowledgeMod = await import(KNOWLEDGE_PATH);
  return knowledgeMod;
}
async function packetDriver() {
  if (!packetMod) packetMod = await import(PACKET_PATH);
  return packetMod;
}

// ---------------------------------------------------------------------------
// W45·331-1 (Keywright): `.env` API-key resolution.
//
// The CLI used to read the process environment only, so a stale Windows
// User-scope DEEPSEEK_API_KEY silently shadowed the funded key in the repo
// `.env` and every keyed call 401'd on a key the operator never chose.
// Precedence (documented in scripts/README-cli.md "API key resolution"):
//
//   <cwd>/.env  >  the process environment   (a conflicting ambient key is
//   LOUD, coded (RT_E_LLM_KEY_SHADOWED) and tail-only — never a silent win).
//   A process DEEPSEEK_API_KEY that is present but BLANK/whitespace is an
//   intentional DISABLE: `.env` is NOT consulted and the run stays keyless
//   (the repo's keyless-forcing convention, e.g. headless.test's runCli).
//
// Resolved from the WORKING DIRECTORY (standard dotenv semantics): the
// documented invocations run from the repo root, so `<cwd>/.env` IS
// `<repo>/.env` — and a child spawned with a different cwd (the CLI test
// harnesses) keeps its own keyless environment untouched.
//
// The physical read lives here (this file already owns node:fs); the pure
// parse/resolve logic lives in src/lib/llm/providers/key-resolution.ts.
// ---------------------------------------------------------------------------
const KEY_RESOLUTION_PATH = pathToFileURL(
  join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "llm", "providers", "key-resolution.ts"),
).href;
const DOTENV_PATH = resolve(process.cwd(), ".env");
const DEEPSEEK_SERVER_PATH = pathToFileURL(
  join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "deepseek.server.ts"),
).href;

let keyResolutionMod = null;
async function keyResolutionDriver() {
  if (!keyResolutionMod) keyResolutionMod = await import(KEY_RESOLUTION_PATH);
  return keyResolutionMod;
}

// Non-secret provenance respond() reads to build a dynamic remedy. NEVER the key.
let KEY_SOURCE = null; // { kind, path, tail, conflict }

/** Resolve DEEPSEEK_API_KEY from <cwd>/.env + the process env and INSTALL it. */
async function installRepoEnvKey() {
  let text = "";
  try {
    text = readFileSync(DOTENV_PATH, "utf8");
  } catch {
    text = ""; // no .env → the process environment is the only source
  }
  let mod;
  try {
    mod = await keyResolutionDriver();
  } catch {
    return; // resolution module absent → legacy process-env read, unchanged
  }
  // Declare the file for THIS process so the provider's own key read
  // (resolveProcessKey via key-source.server.ts) resolves identically — e.g. a
  // 401 then names `<cwd>/.env` rather than "the process environment".
  process.env.RAPIDTOOL_LLM_ENV_FILE = DOTENV_PATH;
  const parsed = mod.parseEnvFile(text);
  const resolution = mod.resolveApiKey({
    name: "DEEPSEEK_API_KEY",
    envFileValue: parsed.DEEPSEEK_API_KEY ?? null,
    envFilePath: DOTENV_PATH,
    processValue: process.env.DEEPSEEK_API_KEY ?? null,
  });
  if (resolution.effective) {
    process.env.DEEPSEEK_API_KEY = resolution.effective.value;
    mod.setActiveKeySource(resolution.effective);
    KEY_SOURCE = {
      kind: resolution.effective.kind,
      path: resolution.effective.path,
      tail: resolution.effective.tail,
      conflict: resolution.conflict,
    };
  } else {
    mod.setActiveKeySource(null);
    KEY_SOURCE = null;
  }
  if (resolution.conflict) {
    // Loud, coded, tail-only. stderr only — stdout stays exactly one JSON object.
    try {
      process.stderr.write(mod.formatShadowWarning("DEEPSEEK_API_KEY", DOTENV_PATH, resolution.conflict) + "\n");
    } catch {
      /* stderr unusable — the conflict is still resolved, never silently */
    }
  }
}

// ---------------------------------------------------------------------------
// G: headless NDJSON event log (runtime-log.server.ts, same lazy mechanics).
// cliLogEvent(seed) stamps + appends one row under logs/ (best-effort).
// ---------------------------------------------------------------------------
const RT_PATH = pathToFileURL(
  join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "runtime-log.server.ts"),
).href;
const RT_DIAG_PATH = pathToFileURL(
  join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "diagnose.ts"),
).href;
// W40 N5 (OPS-10): the budget constants' single authority — `diagnose.ts`
// itself imports WILD_STEP_BUDGET_MS / CHAT_STEP_BUDGET_MS from here, so the
// CLI reads them too instead of duplicating their values as literals.
const RT_EVENTS_PATH = pathToFileURL(
  join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "rt-events.ts"),
).href;

let rtServer = null;
let rtDiag = null;
let rtEvents = null;
let rtSessionId = `cli-${Date.now().toString(36)}`;
let CLI_PROJECT = null;

async function ensureRtAppender() {
  if (rtServer) return;
  try {
    rtServer = await import(RT_PATH);
  } catch {
    rtServer = null; // module absent → no event log; everything still works
  }
}

// fixes/217e (G1): synchronous (no awaits inside — makeCliRow + appendRtLine
// are fs-sync), so respond() can stamp the exit log and process.exit in the
// same tick instead of yielding to the event loop first.
function cliLogEvent(seed) {
  try {
    if (!rtServer) return;
    const row = rtServer.makeCliRow(seed, rtSessionId);
    rtServer.appendRtLine(row, { logDir: rtServer.resolveLogDir(CLI_PROJECT) });
  } catch {
    /* telemetry must never break the command */
  }
}

// E-10/E-25: --report accepts inline JSON, '@file.json' or '-' (stdin).
async function readReportSource(value) {
  if (value === "-") {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString("utf8");
  }
  if (value.startsWith("@")) {
    const path = value.slice(1);
    if (!path.trim()) return "";
    return readFileSync(path, "utf8");
  }
  return value;
}

// ---------------------------------------------------------------------------
// S2 / AW45-c07 (W46 · 332-4): `create --brief <path>` used to feed the raw
// PATH to the pipeline as prose — inferName named the project after the path
// and the lattice extracted nouns from the filename. Three honest shapes:
//   · `--brief @<path>`  — read the file (the ingest `--report @file.json`
//     convention). A YAML-front-matter corpus fixture (research/eval-corpus/*)
//     carries the real prose in its `brief:` scalar; extract that instead of
//     feeding the front matter to the lattice.
//   · `--brief "<prose>"` — the text itself.
//   · a bare value that names an EXISTING, readable file is refused CODED,
//     naming both forms — never silently used as prose.
// ---------------------------------------------------------------------------
/** True when `p` resolves to an existing regular file (unstattable ⇒ false). */
function isReadableFile(p) {
  try {
    return statSync(p).isFile();
  } catch {
    /* not a path we can stat — treat as a non-file value, never a crash */
    return false;
  }
}

/**
 * The `brief:` scalar of a leading YAML front-matter fence, or null. Scoped to
 * the one shape the corpus fixtures use: a single-line, optionally quoted
 * scalar (run-eval.mjs parseFrontmatter is the full parser; the CLI needs only
 * this field).
 * @param {string} text
 * @returns {string | null}
 */
function briefFromFrontmatter(text) {
  if (!text.startsWith("---")) return null;
  const end = text.indexOf("\n---", 3);
  if (end === -1) return null;
  const m = text.slice(3, end).match(/^brief:\s*(.+)$/m);
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v.trim() || null;
}

/**
 * Resolve `create --brief` to prose.
 * @param {string} raw
 * @returns {{ value: string; error?: undefined } | { value?: undefined; error: string }}
 */
function readBriefSource(raw) {
  if (raw.startsWith("@")) {
    const path = raw.slice(1).trim();
    if (!path) return { error: "create: --brief @ needs a file path (got a bare @)." };
    if (!isReadableFile(path)) {
      return { error: `create: --brief @${path} does not name a readable file.` };
    }
    let text;
    try {
      text = readFileSync(path, "utf8");
    } catch (err) {
      return { error: `create: --brief @${path} could not be read — ${err instanceof Error ? err.message : String(err)}` };
    }
    const fm = briefFromFrontmatter(text);
    return { value: fm ?? text };
  }
  if (isReadableFile(raw)) {
    return {
      error:
        `create: --brief ${JSON.stringify(raw)} names an existing file — a file path is never silently ` +
        `used as the brief prose (it would name the project after the path). Read it with --brief @${raw} ` +
        `or pass the text itself: --brief "<prose>".`,
    };
  }
  return { value: raw };
}

// ---------------------------------------------------------------------------
// G4/fixes/144 (M1): findable output defaults.
// ---------------------------------------------------------------------------
// Software deliverables (`emit`) and knowledge vaults (`vault`) default to a
// NAMED, per-project folder under the user's home — never a CWD-relative
// ./emit|vault buried in whatever directory the shell happened to be in:
//
//   emit:   <os.homedir()>/RapidTool Software/<slug>/
//   vault:  <os.homedir()>/RapidTool Software/<slug>/vault
//
// `--out` always overrides. <slug> is io.ts slugName (headless re-exports it
// as h.filename): lowercase, spaces/non-alphanumerics -> "-", trimmed, and ""
// -> "project" — the SAME slug the packet/JSON downloads use (io.ts:340), so a
// project named "HVAC Dispatch" always lands in .../hvac-dispatch/ no matter
// which verb wrote it. mkdirSync(recursive) is attempted up front; when the
// home location cannot be created (server/CI, unwritable profile dir) the
// default FALLS BACK to a per-project folder in the CWD so an emit never
// silently dies on a bad homedir. Never hardcode a Windows path here —
// homedir() + path.join keep this portable (fixes/143 g4 F1).
function defaultOutputDir(h, project, ...sub) {
  const slug = h.filename(project.name);
  const target = join(homedir(), "RapidTool Software", slug, ...sub);
  try {
    mkdirSync(target, { recursive: true });
    return { path: target, fallback: false, error: null };
  } catch (err) {
    const fallback = resolve(slug, ...sub);
    mkdirSync(fallback, { recursive: true });
    return {
      path: fallback,
      fallback: true,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// T-107.7 (W33 lane L2): resolve a `resume --project` value to the checkpoint
// home + the optional project file. A DIRECTORY is its own checkpoint home
// (`<dir>/.rapidtool/checkpoint.json` — where run/gate wrote it); a file
// resolves to its containing dir and names the file to save back to.
// W36 N2 consumes it from the real `resume`/`unattended` arms below.
// ---------------------------------------------------------------------------
function resolveCheckpointTarget(value) {
  const abs = resolve(value);
  try {
    if (statSync(abs).isDirectory()) return { dir: abs, file: null };
  } catch {
    /* not on disk (yet) — treat as a project file path */
  }
  return { dir: dirname(abs), file: abs };
}

// ---------------------------------------------------------------------------
// T-107.7/W-47 (W36 lane N2): ONE outcome→envelope mapper for the two drive
// verbs this lane adds (`resume`, `unattended`). Mirrors the run/gate arm's
// contract — parked → 2, hard-DoD block → 1 RT_E_GATE_PENDING, a complete seal
// with failed gates is never a clean 0 → 1 RT_E_GATES_FAILED — and carries the
// resume provenance (`checkpoint`) + `unattended: true` markers in `extras`.
// The run/gate arm predates this helper and is intentionally untouched.
// ---------------------------------------------------------------------------
function respondDriveOutcome(h, res, { path, extras = {} }) {
  const sealed = h.summary(res.project);
  if (res.outcome === "dod") {
    respond(
      {
        ok: false,
        path,
        ...extras,
        code: "RT_E_GATE_PENDING",
        remedy:
          "A hard DoD red is repaired, not approved: read summary.failedGates (the unmet criteria), fix the phase's artifacts or re-run the phase, then re-run `gate` — no HITL accept/reject door exists for a red gate.",
        error:
          (Array.isArray(res.events) && res.events.length > 0
            ? res.events[res.events.length - 1]
            : "Hard DoD block — advance refused") + " — resolve the unmet DoD criteria before advancing.",
        summary: sealed,
        steps: res.steps,
        stopped: res.stopped,
        events: res.events,
        outcome: "dod",
      },
      1,
    );
    return;
  }
  if (res.project.status === "complete" && sealed.sealedWithFailures === true) {
    const census = (sealed.failedGates ?? [])
      .map((g) => `P${g.phase}(${Array.isArray(g.unmet) && g.unmet.length > 0 ? g.unmet.join(",") : "unmet"})`)
      .join("; ");
    respond(
      {
        ok: false,
        path,
        ...extras,
        code: "RT_E_GATES_FAILED",
        error: `run sealed complete with ${sealed.failedGates?.length ?? 0} failed DoD gate(s): ${census} — resolve the red gates (repair the failing phase and re-run) before shipping.`,
        summary: sealed,
        steps: res.steps,
        stopped: res.stopped,
        events: res.events,
        sealedWithFailures: true,
      },
      1,
    );
    return;
  }
  const parked = res.project.status === "awaiting_hitl" || res.project.status === "blocked";
  respond(
    {
      ok: true,
      path,
      ...extras,
      // W49 boundary: `RunResult.code` names the coded class of the newest P6
      // synthesis refusal THIS invocation recorded (a keyed 401 surfaces as
      // RT_E_LLM_KEY_REJECTED) while the run still advanced on the deterministic
      // floor. It is surfaced under its OWN name — never as `code`, which the
      // taxonomy reserves for a failed command — so an agent driving blind sees
      // the refusal without mistaking ok:true for a failure. Absent when the
      // invocation recorded no refusal (additive + conditional).
      ...(typeof res.code === "string" && res.code ? { refusalCode: res.code } : {}),
      summary: sealed,
      steps: res.steps,
      stopped: res.stopped,
      events: res.events,
    },
    parked ? 2 : 0,
  );
}

// ---------------------------------------------------------------------------
// 330 Switchboard (T4): the ONE `--knowledge` resolver for the run-driving
// verbs. `run`/`gate`/`unattended` thread the human-accepted cross-project
// lesson rows into the headless driver as `proven` — the same tier-1 seed the
// `packet` arm carries (`packet.ts:compileAgentPacket({proven})`), so a store
// of accepted lessons reaches the expansion chain through the drive path too.
//
// The limit is the codegen chain's OWN constant (`EXPAND_LESSON_RANK_LIMIT`,
// knowledge.ts:45) read off the module — never a magic number that can drift
// from it. A valueless `--knowledge` is refused loudly (R5-f10 class: a bare
// flag parses to `true` and would otherwise be silently ignored). A configured
// store that cannot be read is a coded refusal at exit 4 carrying the store's
// own reason — the packet arm's exact shape (329 · 328 P5) — never a silent
// "no lessons". Absent flag ⇒ `{ present: false }` and the option is omitted,
// so the drive stays byte-identical to today.
// ---------------------------------------------------------------------------
async function resolveProvenRows(cmdName, args, project) {
  if (typeof args.knowledge === "undefined") return { present: false };
  if (pathFlagMissing(args.knowledge)) {
    return respond(
      { ok: false, error: pathFlagRefusalError(cmdName, "knowledge", args.knowledge), code: "RT_E_VALIDATION" },
      1,
    );
  }
  const k = await knowledgeDriver();
  const resolved = k.provenRowsFromStore(resolve(args.knowledge), project.name, {
    limit: k.EXPAND_LESSON_RANK_LIMIT,
  });
  if (resolved.degraded) {
    return respond(
      {
        ok: false,
        error: `${cmdName}: cannot seed proven lessons from ${args.knowledge}: ${resolved.reason ?? "the store could not be read"}`,
        code: resolved.code ?? "RT_E_INTERNAL",
      },
      4,
    );
  }
  return { present: true, rows: resolved.rows };
}

// ---------------------------------------------------------------------------
// Subcommands.
// ---------------------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  CMD = cmd ?? null;
  CLI_PROJECT = typeof args.project === "string" ? args.project : null;

  await ensureErrorCodes(); // failures carry `code` (RT_E_*) on every envelope
  await ensureRtAppender(); // G: NDJSON event log under logs/ for every command

  // W49 · 335-4 (Switchboard): an agent (or a human) must be able to ASK for the
  // synopsis and get a SUCCESS. Before this, `--help` / `-h` / `help` were just
  // an empty or unknown subcommand — the bytes were a coded REFUSAL (exit 1,
  // ok:false), so an agent that branches on the exit code read discovery as a
  // failure. A help request is not an error: ok:true + exit 0, carrying the same
  // USAGE the refusal paths carry, narrowed to one verb's line when a known verb
  // is named (`--help emit` / `help emit`).
  // NB: parseArgs absorbs `--help emit` as `args.help === "emit"` (a value, not
  // a boolean) — that string is the verb candidate, not a stray value.
  if (args.help === true || typeof args.help === "string" || args._.includes("-h") || args._.includes("help")) {
    const candidates = typeof args.help === "string" ? [args.help, ...args._] : [...args._];
    const verb = candidates.find((a) => a !== "-h" && a !== "help" && USAGE.commands[a] !== undefined);
    respond(
      verb !== undefined
        ? {
            ok: true,
            verb,
            usage: { description: USAGE.description, help: USAGE.help, commands: { [verb]: USAGE.commands[verb] } },
          }
        : { ok: true, usage: USAGE },
      0,
    );
  }

  if (!cmd) {
    respond({ ok: false, error: "Missing subcommand.", usage: USAGE, code: "RT_E_VALIDATION" }, 1);
    return;
  }

  // 330 Switchboard (probed): the agent seal is a WILD-RUN concept — the CLI
  // banner and USAGE.wild both state `wild` is "the ONLY verb that accepts it",
  // yet only five drive verbs actually refused it (316 H3). Every other verb
  // (reject/emit/create/scan/… — 30+) silently ABSORBED the governance flag and
  // returned a success envelope, so a caller could believe the seal had applied
  // when it never could. A governance flag is never silently ignored: the
  // refusal is hoisted to ONE pre-dispatch guard covering every non-wild verb,
  // before ANY project load (hoisted above the per-arm sites it replaces, which
  // are now redundant).
  if (cmd !== "wild" && flag(args, "agent-seal")) return refuseAgentSeal(cmd);

  // S3 (W46 · 332-4): a value flag with no value never rides through to a
  // silent default — refuse it coded, naming the flag, before ANY dispatch.
  const bareValueFlag = VALUELESS_VALUE_FLAGS.find((key) => args[key] === true);
  if (bareValueFlag !== undefined) return refuseValuelessFlag(cmd, bareValueFlag);

  // W49 · 335-4: the same refusal for a documented NUMERIC flag whose value is
  // present but not a non-negative integer (silently dropped before — see
  // NUMERIC_VALUE_FLAGS above).
  const badNumericFlag = NUMERIC_VALUE_FLAGS.find(
    (key) => typeof args[key] === "string" && !/^\d+$/.test(args[key]),
  );
  if (badNumericFlag !== undefined) return refuseNonNumericFlag(cmd, badNumericFlag, args[badNumericFlag]);

  // W45·331-1 (Keywright): resolve DEEPSEEK_API_KEY from <repo>/.env + the
  // process env BEFORE any dispatch, so every keyed verb (and create's
  // enforceDod default) sees the repo's key, and a conflicting ambient key is
  // surfaced loud + coded rather than silently shadowing it.
  await installRepoEnvKey();

  // E-25: shared project loader — missing/bad project file is a usage-class
  // error (exit 1), never an internal error (exit 4).
  const makeLoader = (h) => (cmdName) => {
    const proj = requireArg(args, "project", cmdName);
    // fixes/217e (G1): `return` the refusal — respond() exits; without it the
    // verb fell through and ran with `undefined` (audit 216y §2.3 G1).
    if (proj.error !== undefined) return respond({ ok: false, error: proj.error, code: "RT_E_VALIDATION" }, 1);
    try {
      return h.loadProject(proj.value);
    } catch (err) {
      // Classify the OBJECT: a read ENOENT → RT_E_PROJECT_MISSING; a malformed
      // project file (JSON/shape) → RT_E_VALIDATION. Prose could not tell them apart.
      // fixes/217e (G1): same refusal contract — `return` ends the verb here.
      return respond(
        {
          ok: false,
          error: `${cmdName}: ${err instanceof Error ? err.message : String(err)}`,
          ...errCode(err, "RT_E_VALIDATION"),
        },
        1,
      );
    }
  };

  try {
    const h = await driver();
    const abortStamp = (sig) => {
      if (!CLI_PROJECT) return;
      try {
        const p = h.runAcceptance(h.loadProject(CLI_PROJECT), "aborted", sig);
        h.saveProject(CLI_PROJECT, p);
      } catch {
        /* best-effort */
      }
    };
    process.once("SIGTERM", () => {
      abortStamp("SIGTERM");
      process.exit(143);
    });
    process.once("SIGINT", () => {
      abortStamp("SIGINT");
      process.exit(130);
    });
    const loadProjectFor = makeLoader(h);

    switch (cmd) {
      case "create": {
        const brief = requireArg(args, "brief", "create");
        if (brief.error !== undefined) return respond({ ok: false, error: brief.error, code: "RT_E_VALIDATION" }, 1);
        // S2 / AW45-c07: '@<path>' reads the file (front-matter `brief:` unwrapped);
        // a bare existing-file path is refused rather than fed to the lattice.
        const briefSource = readBriefSource(brief.value);
        if (briefSource.error !== undefined) {
          return respond({ ok: false, error: briefSource.error, code: "RT_E_VALIDATION" }, 1);
        }
        let project = h.createProject({ brief: briefSource.value, name: args.name });
        // fixes/132 (C2): keyed runs default enforceDod ON (hard DoD gates);
        // --advisory restores advisory-only behavior. The flip happens before
        // anything observes the project — the saved file carries the flag.
        if (flag(args, "advisory")) project = { ...project, enforceDod: false };
        // fixes/144 (M1): create's default STAYS CWD-relative <slug>.json — the
        // project JSON is an intermediate control file that every later verb
        // consumes via --project, so it must stay next to the shell chaining the
        // verbs (g4 F1 keeps it; only the DELIVERABLE emit + vault moved home).
        // R5-f10 (W29 · A2-f11): a valueless --out used to melt into the
        // default and silently write <slug>.json into the CWD — refuse loudly,
        // nothing written.
        if (pathFlagMissing(args.out)) {
          return respond(
            { ok: false, error: pathFlagRefusalError("create", "out", args.out), code: "RT_E_VALIDATION" },
            1,
          );
        }
        const out = resolve(typeof args.out === "string" ? args.out : `${h.filename(project.name)}.json`);
        h.saveProject(out, project);
        // 326 F2c (C2 · monitors' OBS-T3-1): the exit row belongs NEXT TO the
        // project this command CREATED — CLI_PROJECT is the single input to
        // resolveLogDir (:486), and respond() exits in-tick (:243) so no later
        // verb logic reads it. Failure paths above still stamp the invoker's
        // cwd because no project exists yet (the doc's split —
        // runtime-log.server.ts:47-50 — now holds for create too).
        CLI_PROJECT = out;
        // Surface the EFFECTIVE enforcement value (create default policy is
        // env-dependent, so the caller must never guess it).
        respond(
          { ok: true, path: out, summary: h.summary(project), enforceDod: project.enforceDod === true },
          0,
        );
        return;
      }

      case "run":
      case "gate": {
        // 316 H3 (315 V2 finding #4): the seal cannot apply to this driver
        // (runUntilGate never reads WildStepOptions.agentSeal) — the absorbed
        // flag is refused with the pointer instead of silently ignored. The
        // refusal now fires from the ONE pre-dispatch guard in main() (330),
        // before this arm is even reached.
        const project = loadProjectFor(cmd);
        const path = requireProjectPath(args, cmd);
        // W-47 / T-107.4 (W33 lane L2): `run --unattended` drives the keyed
        // journey headless to completion unattended — autopilot ON (machine
        // gates only) + live ON (P6 through the shared runP6Edge seam; keyless
        // ⇒ the honest deterministic floor). It is NOT a daemon: a host
        // scheduler (Windows Task Scheduler / cron) invokes it on a cadence.
        // 341-6: the unattended arms pass `machineGates: true`, so a stock HITL
        // gate (P4/P5/P8/P9) whose DoD passes is cleared through the ledgered
        // machine actor — a genuine human gate (forceHuman) or a red DoD gate
        // still parks (exit 2), never a fake completion.
        const unattended = flag(args, "unattended");
        const autopilot = unattended ? true : cmd === "gate" ? flag(args, "autopilot") : false;
        const live = unattended ? true : flag(args, "live");
        const maxSteps = cmd === "run" && !unattended ? 1 : undefined; // run = single step; gate/unattended = until parked
        // 330 Switchboard (T4): optional `--knowledge <store.json>` seeds the
        // expansion chain with accepted cross-project lessons (the driver's
        // `proven` option — the same rows the packet arm threads).
        const proven = await resolveProvenRows(cmd, args, project);
        const res = await h.runUntilGate(project, {
          autopilot,
          live,
          maxSteps,
          // T-107.7 (W33 lane L2): the per-phase commit writes the bounded
          // checkpoint beside the project dir; a complete seal clears it.
          checkpointDir: dirname(resolve(path)),
          // 341-6: only the --unattended arm opts into stock-gate clearing; the
          // interactive `gate --autopilot` path stays byte-identical.
          ...(unattended ? { machineGates: true } : {}),
          ...(proven.present ? { proven: proven.rows } : {}),
        });
        // M6-04 (312 · E2's owed half; landed 316 · I4): the save goes through
        // the ONE busy-aware helper — bounded wait-and-retry (each attempt
        // re-enters saveProject, so the fixes/310 reclaimStaleLock discipline
        // runs on every retry: a SIGKILL-orphaned lock is reclaimed, a
        // transiently-held live lock usually clears inside the window). A
        // still-live writer gets a CODED RT_E_BUSY refusal at the
        // README-documented busy exit 1 — never the global net's exit 4, the
        // 308 map6 lost-update mislabel — carrying `preserved`: the run
        // checkpoint beside the project dir where the completed phase work
        // lives (`resume --project` re-enters it), so writer contention can
        // never silently discard a run's completed work again.
        const saved = await h.saveProjectBusyAware(path, res.project);
        if (!saved.ok) {
          const cpModule = await checkpointDriver();
          const cpPath = cpModule.checkpointPath(dirname(resolve(path)));
          const cpPresent = existsSync(cpPath);
          respond(
            {
              ok: false,
              path,
              ...(unattended ? { unattended: true } : {}),
              code: "RT_E_BUSY",
              error:
                `${saved.error} — another writer held ${saved.lockPath} through the whole bounded retry window. ` +
                (cpPresent
                  ? `The completed phase work is preserved in the run checkpoint — wait for the writer to exit, then re-enter with \`resume --project ${path}\`.`
                  : `No resume checkpoint exists for this run (a terminal seal clears it) — wait for the writer to exit, then re-run this verb.`),
              preserved: { checkpoint: cpPath, present: cpPresent, resume: cpPresent ? `resume --project ${path}` : null },
              steps: res.steps,
              stopped: res.stopped,
              outcome: res.outcome,
            },
            1,
          );
          return;
        }
        // E-25: parked awaiting human / blocked → exit 2 (state fully on
        // stdout); complete / mid-run cap → 0.
        const parked = res.project.status === "awaiting_hitl" || res.project.status === "blocked";
        // fixes/144 (M4-1 completion gate): a COMPLETE seal with any recorded
        // FAILED DoD gate is NEVER a clean 0 — exit 1 + RT_E_GATES_FAILED +
        // the failed-gate census + sealedWithFailures:true, so a red-gate run
        // can never present byte-identical output to a clean one. (This is the
        // run/gate completion branch — the parked-2 branch above is untouched.)
        const sealed = h.summary(res.project);
        if (res.outcome === "dod") {
          respond(
            {
              ok: false,
              path,
              // W-47: state the drive mode on every outcome (a scheduler that
              // invoked `run --unattended` must be able to see it parked).
              ...(unattended ? { unattended: true } : {}),
              code: "RT_E_GATE_PENDING",
              remedy:
                "A hard DoD red is repaired, not approved: read summary.failedGates (the unmet criteria), fix the phase's artifacts or re-run the phase, then re-run `gate` — no HITL accept/reject door exists for a red gate.",
              error:
                (Array.isArray(res.events) && res.events.length > 0
                  ? res.events[res.events.length - 1]
                  : "Hard DoD block — advance refused") + " — resolve the unmet DoD criteria before advancing.",
              summary: sealed,
              steps: res.steps,
              stopped: res.stopped,
              events: res.events,
              outcome: "dod",
            },
            1,
          );
          return;
        }
        if (res.project.status === "complete" && sealed.sealedWithFailures === true) {
          const census = (sealed.failedGates ?? [])
            .map((g) => `P${g.phase}(${Array.isArray(g.unmet) && g.unmet.length > 0 ? g.unmet.join(",") : "unmet"})`)
            .join("; ");
          respond(
            {
              ok: false,
              path,
              ...(unattended ? { unattended: true } : {}),
              code: "RT_E_GATES_FAILED",
              error: `run sealed complete with ${sealed.failedGates?.length ?? 0} failed DoD gate(s): ${census} — resolve the red gates (repair the failing phase and re-run) before shipping.`,
              summary: sealed,
              steps: res.steps,
              stopped: res.stopped,
              events: res.events,
              sealedWithFailures: true,
            },
            1,
          );
          return;
        }
        respond(
          {
            ok: true,
            path,
            summary: sealed,
            steps: res.steps,
            stopped: res.stopped,
            events: res.events,
          },
          parked ? 2 : 0,
        );
        return;
      }

      // T-107.7 (W36 lane N2): REAL run resume — read the per-phase checkpoint that
      // run/gate wrote beside the project dir, admit it (identity + mode + integer
      // phase/step sanity — checkpointAdmits), hydrate the minimal read shape, and
      // re-enter at the recorded phase through the same runUntilGate driver the
      // original run used. Never a silent resume: the envelope names the snapshot
      // age + the re-entry phase. `--project` accepts a project FILE (its dir is
      // the checkpoint home; the drive writes the file back) or a DIRECTORY.
      case "resume": {
        // 316 H3 (315 V2 finding #4): same silent-absorb class — the seal is
        // a wild-run concept; the pointer refusal rides the ONE pre-dispatch
        // guard in main() (330).
        const target = requireArg(args, "project", "resume");
        if (target.error !== undefined) return respond({ ok: false, error: target.error, code: "RT_E_VALIDATION" }, 1);
        const t = resolveCheckpointTarget(target.value);
        // Identity guard: when a project FILE was named and exists, admit against ITS
        // id (an id reused by a different brief must fail closed); a directory names
        // no expected id — the checkpoint's own identity governs.
        let expected;
        // fixes/323 FIX-2c (X2b OBS): the loaded file doubles as the staleness
        // comparison subject below — a snapshot the file has moved past must
        // never be silently resumed over it.
        let fileProject = null;
        if (t.file && existsSync(t.file)) {
          try {
            fileProject = h.loadProject(t.file);
            expected = { projectId: fileProject.id };
          } catch {
            /* an unreadable file cannot pin identity — the checkpoint's own id governs */
          }
        }
        const resumed = h.loadResumableCheckpoint(t.dir, expected);
        if (!resumed.ok) {
          return respond({ ok: false, path: resumed.path, dir: t.dir, code: resumed.code, error: resumed.error }, 1);
        }
        // fixes/323 FIX-2c (X2b OBS): ignore-with-notice when the named project
        // FILE has superseded the snapshot (id / seal / brief / phase / state
        // comparison — checkpointSupersededBy). The file is the current truth;
        // driving from the snapshot would rewind it (the live X2b repro: a
        // stale P4 gate-park snapshot rewound a file already advanced to P5).
        // The notice rides `checkpoint` — never a silent switch.
        const stale = fileProject ? h.checkpointSupersededBy(resumed.project, resumed.resumedFrom.phase, fileProject) : null;
        if (stale && stale.superseded && fileProject) {
          const res = await h.runUntilGate(fileProject, {
            autopilot: flag(args, "autopilot"),
            live: flag(args, "live"),
            checkpointDir: t.dir,
          });
          if (t.file) h.saveProject(t.file, res.project);
          respondDriveOutcome(h, res, {
            path: t.file,
            extras: {
              resumed: false,
              checkpoint: {
                path: resumed.path,
                savedAt: resumed.savedAt,
                ageMs: Date.now() - resumed.savedAt,
                resumedFrom: resumed.resumedFrom,
                ignored: true,
                superseded: true,
                reason: stale.reason,
              },
            },
          });
          return;
        }
        const ageMs = Date.now() - resumed.savedAt;
        const res = await h.runUntilGate(resumed.project, {
          autopilot: flag(args, "autopilot"),
          live: flag(args, "live"),
          checkpointDir: t.dir,
        });
        if (t.file) h.saveProject(t.file, res.project);
        respondDriveOutcome(h, res, {
          path: t.file ?? t.dir,
          extras: {
            resumed: true,
            checkpoint: { path: resumed.path, savedAt: resumed.savedAt, ageMs, resumedFrom: resumed.resumedFrom },
          },
        });
        return;
      }

      // W-47/T-107.4 (W36 lane N2): the scheduler-facing drive, REAL where the host
      // allows — re-enter from a checkpoint when one exists (crash recovery: a Task
      // Scheduler / cron re-invocation resumes instead of restarting), else start
      // from the named project file; drive autopilot + live until parked. NOT a
      // daemon: no scheduler/queue in-product — an external hook invokes this verb
      // on a cadence. 341-6: this verb passes `machineGates: true`, so a stock
      // HITL gate (P4/P5/P8/P9) whose DoD passes is cleared through the ledgered
      // machine actor (approve --seat autopilot's actor) — a genuine human gate
      // (forceHuman) or a red DoD gate still parks: exit 2 is then the honest
      // outcome, never a fake completion.
      case "unattended": {
        // 316 H3 (315 V2 finding #4): same silent-absorb class — the seal is
        // a wild-run concept; the pointer refusal rides the ONE pre-dispatch
        // guard in main() (330).
        const target = requireArg(args, "project", "unattended");
        if (target.error !== undefined) return respond({ ok: false, error: target.error, code: "RT_E_VALIDATION" }, 1);
        const t = resolveCheckpointTarget(target.value);
        const resumed = h.loadResumableCheckpoint(t.dir);
        // fixes/323 FIX-2c (X2b OBS): the named FILE (when it exists) is loaded
        // up front — a scheduler re-invocation must never resume a snapshot the
        // file has moved past; the file is the current truth and drives below.
        let fileProject = null;
        if (t.file && existsSync(t.file)) {
          try {
            fileProject = h.loadProject(t.file);
          } catch {
            /* an unreadable file cannot join the comparison — the refusals below / the drive's own validation own that failure */
          }
        }
        let project;
        let extras = { unattended: true };
        if (resumed.ok) {
          // fixes/323 FIX-2c (X2b OBS): ignore-with-notice when the file has
          // superseded the snapshot (checkpointSupersededBy — id / seal / brief
          // / phase / state). The stale snapshot is never consumed: the drive
          // starts from the file and the notice rides `checkpoint`.
          const stale = fileProject ? h.checkpointSupersededBy(resumed.project, resumed.resumedFrom.phase, fileProject) : null;
          if (stale && stale.superseded && fileProject) {
            project = fileProject;
            extras = {
              unattended: true,
              resumed: false,
              checkpoint: {
                path: resumed.path,
                savedAt: resumed.savedAt,
                ageMs: Date.now() - resumed.savedAt,
                resumedFrom: resumed.resumedFrom,
                ignored: true,
                superseded: true,
                reason: stale.reason,
              },
            };
          } else {
            project = resumed.project;
            extras = {
              unattended: true,
              resumed: true,
              checkpoint: {
                path: resumed.path,
                savedAt: resumed.savedAt,
                ageMs: Date.now() - resumed.savedAt,
                resumedFrom: resumed.resumedFrom,
              },
            };
          }
        } else if (resumed.code === "RT_E_CHECKPOINT_MISSING" && t.file && existsSync(t.file)) {
          // No checkpoint: a fresh project (or one whose COMPLETE seal cleared it) —
          // start from the file; the drive below writes a fresh checkpoint per phase.
          try {
            project = fileProject ?? h.loadProject(t.file);
          } catch (err) {
            return respond(
              {
                ok: false,
                unattended: true,
                error: `unattended: ${err instanceof Error ? err.message : String(err)}`,
                ...errCode(err, "RT_E_VALIDATION"),
              },
              1,
            );
          }
        } else {
          // A corrupt/stale/mismatched checkpoint (or a dir with nothing in it) must
          // never be silently ignored by a scheduler — report the coded refusal.
          return respond(
            { ok: false, unattended: true, path: resumed.path, dir: t.dir, code: resumed.code, error: resumed.error },
            1,
          );
        }
        // 330 Switchboard (T4): optional `--knowledge <store.json>` seeds the
        // expansion chain with accepted cross-project lessons (same resolver
        // as run/gate).
        const proven = await resolveProvenRows("unattended", args, project);
        const res = await h.runUntilGate(project, {
          autopilot: true,
          live: true,
          machineGates: true,
          checkpointDir: t.dir,
          ...(proven.present ? { proven: proven.rows } : {}),
        });
        if (t.file) h.saveProject(t.file, res.project);
        respondDriveOutcome(h, res, { path: t.file ?? t.dir, extras });
        return;
      }

      case "approve": {
        // 316 H3 (315 V2 finding #4): `approve --agent-seal` used to be
        // absorbed by parseArgs (silently ignored — the pre-fix no-op the V2
        // deep-check reproduced). The seal cannot ride this door: `approve`
        // drives the single human/machine gate decision, never the wild loop.
        // The pointer refusal now rides the ONE pre-dispatch guard in main()
        // (330), before this arm is reached.
        const project = loadProjectFor("approve");
        if (project.status !== "awaiting_hitl" || !project.hitl) {
          // 326 F2b (C1 · E2-OBS-5 class): the RT_E_GATE_PENDING registry
          // remedy ("Route the project through the open HITL prompt …") points
          // at a door that CANNOT exist in this branch — it fires exactly when
          // hitl is null (no park, no prompt). Keep the code + error bytes
          // (recorded envelopes depend on them); ship the honest context
          // remedy (an explicit `remedy` bypasses respond()'s registry
          // default-attach, :190-192).
          return respond(
            {
              ok: false,
              error: `No pending gate to approve (status: ${project.status}).`,
              code: "RT_E_GATE_PENDING",
              remedy:
                "No HITL accept door is open (approve needs status=awaiting_hitl with a pending gate): read the latest verdict (`diagnose`; summary.failedGates / summary.lastGate) and drive the run forward with `gate` — a red DoD gate is repaired, not approved; never fabricate a decision.",
            },
            1,
          );
        }
        // Drift guard: a stale gate (hitl on another phase) is a state error
        // the engine refuses loudly — surface it as exit 1 + PHASE_ILLEGAL
        // instead of letting it escape to the exit-4 internal catch-all.
        if (project.hitl.phase !== project.currentPhase) {
          return respond(
            {
              ok: false,
              error: `approve: pending gate is for P${project.hitl.phase} but the current edge is P${project.currentPhase} — state drifted; refusing a silent no-op.`,
              code: "RT_E_PHASE_ILLEGAL",
            },
            1,
          );
        }
        // 216 (T0.7 — actor-seam fix): this guard used to cover ONLY --force,
        // so an agent calling `approve` non-interactively WITHOUT --force
        // silently minted decidedBy:"human" — no TTY, no note, no seat
        // evidence (the reproduced forged-advance path). The human seat is now
        // required for EVERY non-TTY approval. An unattended process must use
        // the autopilot seat; it may not impersonate the human seat by default.
        //
        // 314 F5 (K2/K5 · fixes/311_sd_product §1): the seat is never GUESSED.
        // The 216 guard left two kinks: (K2) a bare `approve` on a TTY passed
        // through to the ternary below, silently attributing a HUMAN's
        // decision to the machine seat (decidedBy:"autopilot") — an integrity
        // bug on high-stakes gates; (K5) its non-TTY arm pointed at "the
        // autopilot gate" with no exact next step, while --i-am-human is
        // itself refused off-TTY — a dead end. Now the seat must be NAMED,
        // exactly one of: `--i-am-human` (human ceremony, TTY only — the 216
        // contract) or `--seat autopilot` (EXPLICIT machine attribution, the
        // documented agent door — 311 audit rec. #1 alt / #2). A bare call is
        // refused WITH its exact recovery. headless.approve's own default
        // (HARNESS_APPROVE_ACTOR) is untouched — this discipline is the CLI
        // verb's.
        const humanClaim = flag(args, "i-am-human");
        const seatArg = args.seat;
        const machineSeat = seatArg === "autopilot";
        if (seatArg !== undefined && !machineSeat) {
          const shown = seatArg === true ? "(no value)" : JSON.stringify(seatArg);
          return respond(
            {
              ok: false,
              error: `approve: --seat ${shown} is not a seat — name 'autopilot' for an explicit machine decision, or drop --seat and pass --i-am-human for the human seat.`,
              code: "RT_E_VALIDATION",
              remedy:
                "Re-run with exactly one seat: `approve --project <p> --seat autopilot` (explicit machine attribution) or `approve --project <p> --i-am-human` from an interactive terminal (human seat).",
            },
            1,
          );
        }
        if (humanClaim && machineSeat) {
          return respond(
            {
              ok: false,
              error:
                "approve: --i-am-human and --seat autopilot are mutually exclusive — a decision is either a person's or the machine's; name exactly one seat.",
              code: "RT_E_VALIDATION",
              remedy:
                "Drop one flag: keep `--i-am-human` for the human seat (TTY-only) or `--seat autopilot` for explicit machine attribution.",
            },
            1,
          );
        }
        if (!humanClaim && !machineSeat) {
          const forceClause = flag(args, "force")
            ? " (--force additionally requires the verified human seat — a machine may never force past a gate)"
            : "";
          return respond(
            {
              ok: false,
              error:
                process.stdin.isTTY === true
                  ? `approve: no seat named — a bare approval would be attributed to the MACHINE (decidedBy:"autopilot") and the seat is never guessed.${forceClause} Name the seat: \`--i-am-human\` for a human decision (typed RT_HUMAN_SEAT_TOKEN re-entry at the prompt) or \`--seat autopilot\` for an explicit machine decision.`
                  : `approve from a non-TTY names no claimable seat — the human seat needs an interactive terminal (--i-am-human + typed RT_HUMAN_SEAT_TOKEN re-entry; refused off-TTY) and a machine decision must be explicit.${forceClause} Next step: \`approve --project <p> --seat autopilot\` for an explicit machine approval, or run the verb from a terminal where a person can confirm.`,
              code: "RT_E_VALIDATION",
              remedy:
                "Name exactly one seat: `--seat autopilot` (explicit machine attribution, works non-TTY) or `--i-am-human` from an interactive terminal (human seat, typed token re-entry).",
            },
            1,
          );
        }
        // W44 X2 (seeded ticket T · fixes/321_d2_monitor F-2): a forceHuman gate
        // is HUMAN-ONLY (R3/B-03) — a rejected review park / failed P6 sandbox
        // is never machine-cleared. The engine enforces this with a bare throw
        // (engine.approveHitl), which main()'s internal catch wraps as
        // RT_E_INTERNAL / exit 4 + the generic "retry / escalate" remedy — the
        // WRONG class for a deterministic governance refusal. The gate's own
        // state is already loaded here, so refuse CODED at the verb (usage
        // class, exit 1, remedy = the human door) before the driver call; the
        // engine throw stays as defense-in-depth (live bytes:
        // C:/Users/mnril/w44_trial/live1/03_sealed_approve_autopilot.out).
        if (machineSeat && project.hitl.forceHuman) {
          return respond(
            {
              ok: false,
              error: `approve: the open gate (P${project.hitl.phase}) is human-only (forceHuman — R3/B-03): a machine seat may never approve a forceHuman gate, and --force cannot carry it either.`,
              code: "RT_E_VALIDATION",
              remedy:
                "Use the human door: run `approve --project <p> --i-am-human` from an interactive terminal (typed RT_HUMAN_SEAT_TOKEN re-entry), or send the phase back with `reject --project <p> --note <qualitative feedback>`. A forceHuman gate can never be machine-approved.",
            },
            1,
          );
        }
        // 216o (T-107.3 · P0-01/P0-06 · W5-L3 — the CLI length of the ONE seam):
        // the approve verb consults the policy seam BEFORE handing the decision
        // to the driver, which re-checks at the same seam (defense in depth, one
        // rule). Action routing mirrors headless.approve: --force ⇒ hitl.force
        // (Rule B — the human seat plus the out-of-band token; an autopilot seat
        // can never self-approve a force); otherwise hitl.approve on
        // gate:P<phase>.
        //
        // R5-f12 (W29 LANE H · R11-f04/C2-f02): the --i-am-human claim goes
        // through the TWO-CHANNEL seat (see humanSeatClaim): the TYPED TTY
        // re-entry is the presented token, the env read the expected one — the
        // same-env-var-both-sides degeneracy this replaces is statically
        // forbidden by scripts/cli-exit-taxonomy.test.mjs. A non-TTY
        // --i-am-human is refused before this seam (no second channel exists
        // there, so no human row may be minted); the non-TTY guard above still
        // requires the human seat to be named explicitly for every approval.
        //
        // W6-L2 (ledger PROVENANCE): the row this verb lands is minted by
        // h.approve below, whose seam verdict stamps `decidedVia` onto the row
        // (seat label + action/resource/reason + token-path bool, types.ts) —
        // this verb's consult above and the driver's re-check derive from the
        // same actor/flags/typed token in one process, so the recorded
        // provenance is exactly this verb's enforced verdict. No response-shape
        // change: the approve JSON contract + exit codes stay byte-identical.
        const { evaluatePolicy } = await import("../src/lib/policy.ts");
        // 314 F5: re-read via flag() on purpose — the W29 static pin
        // (cli-exit-taxonomy.test.mjs) counts `flag(args,"i-am-human") ? await
        // humanSeatClaim(` claim sites; `humanClaim` above is the same value.
        const humanSeat = flag(args, "i-am-human") ? await humanSeatClaim("approve") : null;
        if (humanSeat && humanSeat.error !== undefined) {
          return respond({ ok: false, error: humanSeat.error, code: "RT_E_VALIDATION" }, 1);
        }
        const policyVerdict = evaluatePolicy(
          flag(args, "force") ? "hitl.force" : "hitl.approve",
          `gate:P${project.hitl.phase}`,
          humanSeat
            ? {
                actor: humanSeat.actor,
                humanSeatToken: humanSeat.humanSeatToken,
                expectedHumanSeatToken: humanSeat.expectedHumanSeatToken,
              }
            : { actor: { decidedBy: "autopilot", seat: "harness" } },
        );
        if (policyVerdict.decision !== "allow") {
          return respond(
            {
              ok: false,
              error: `approve: refused by the policy seam — ${policyVerdict.reason}`,
              code: "RT_E_VALIDATION",
            },
            1,
          );
        }
        const updated = h.approve(project, { force: flag(args, "force"), actor: humanSeat ? humanSeat.actor : undefined, humanSeatToken: humanSeat ? humanSeat.humanSeatToken : undefined });
        h.saveProject(requireProjectPath(args, "approve"), updated);
        respond({ ok: true, path: requireProjectPath(args, "approve"), summary: h.summary(updated) }, 0);
        return;
      }

      case "reject": {
        const project = loadProjectFor("reject");
        if (project.status !== "awaiting_hitl" || !project.hitl) {
          // 326 F2b (C1 · E2-OBS-5 class): same phantom-door remedy as approve
          // — no HITL reject door exists when hitl is null; ship the honest
          // context remedy instead of the registry default.
          return respond(
            {
              ok: false,
              error: `No pending gate to reject (status: ${project.status}).`,
              code: "RT_E_GATE_PENDING",
              remedy:
                "No HITL reject door is open (reject needs status=awaiting_hitl with a pending gate): read the latest verdict (`diagnose`; summary.failedGates / summary.lastGate) and drive the run forward with `gate` — a red DoD gate is repaired, not approved; never fabricate a decision.",
            },
            1,
          );
        }
        // Drift guard (store.reject ST-2 parity): a stale/duplicated hitl on
        // another phase is a state error → exit 1 + PHASE_ILLEGAL, never exit 4.
        if (project.hitl.phase !== project.currentPhase) {
          return respond(
            {
              ok: false,
              error: `reject: pending gate is for P${project.hitl.phase} but the current edge is P${project.currentPhase} — state drifted; refusing a silent no-op.`,
              code: "RT_E_PHASE_ILLEGAL",
            },
            1,
          );
        }
        const note = requireArg(args, "note", "reject");
        if (note.error !== undefined) return respond({ ok: false, error: note.error, code: "RT_E_VALIDATION" }, 1);
        if (note.value.trim().length < 12) {
          return respond(
            {
              ok: false,
              error: "Rejection requires at least 12 characters of qualitative feedback.",
              code: "RT_E_VALIDATION",
            },
            1,
          );
        }
        // 322 X2 (F-1 scripts half · D2 F-1): the reject door carries the SAME
        // explicit-seat discipline as approve — the seat is never guessed, and a
        // machine path can never mint a human actor. The pre-fix path left the
        // seat to rejectHitl, which hardcoded decidedBy:"human" for EVERY caller
        // (live bytes: live1/05_sealed_reject_note.out — a non-TTY machine
        // reject stamped "human"). Exactly one seat: `--seat autopilot`
        // (explicit machine attribution) or `--i-am-human` (human ceremony —
        // TTY + typed RT_HUMAN_SEAT_TOKEN re-entry, refused off-TTY); the chosen
        // actor rides h.reject's actor parameter (X1's seam).
        const humanClaim = flag(args, "i-am-human");
        const seatArg = args.seat;
        const machineSeat = seatArg === "autopilot";
        if (seatArg !== undefined && !machineSeat) {
          const shown = seatArg === true ? "(no value)" : JSON.stringify(seatArg);
          return respond(
            {
              ok: false,
              error: `reject: --seat ${shown} is not a seat — name 'autopilot' for an explicit machine rejection, or drop --seat and pass --i-am-human for the human seat.`,
              code: "RT_E_VALIDATION",
              remedy:
                "Re-run with exactly one seat: `reject --project <p> --note <t> --seat autopilot` (explicit machine attribution) or `reject --project <p> --note <t> --i-am-human` from an interactive terminal (human seat).",
            },
            1,
          );
        }
        if (humanClaim && machineSeat) {
          return respond(
            {
              ok: false,
              error:
                "reject: --i-am-human and --seat autopilot are mutually exclusive — a decision is either a person's or the machine's; name exactly one seat.",
              code: "RT_E_VALIDATION",
              remedy: "Drop one flag: keep `--i-am-human` for the human seat (TTY-only) or `--seat autopilot` for explicit machine attribution.",
            },
            1,
          );
        }
        if (!humanClaim && !machineSeat) {
          return respond(
            {
              ok: false,
              error:
                process.stdin.isTTY === true
                  ? `reject: no seat named — a bare rejection would carry no claimed seat and the seat is never guessed. Name the seat: \`--i-am-human\` for a human decision (typed RT_HUMAN_SEAT_TOKEN re-entry at the prompt) or \`--seat autopilot\` for an explicit machine decision.`
                  : `reject from a non-TTY names no claimable seat — the human seat needs an interactive terminal (--i-am-human + typed RT_HUMAN_SEAT_TOKEN re-entry; refused off-TTY) and a machine decision must be explicit. Next step: \`reject --project <p> --note <t> --seat autopilot\` for an explicit machine rejection, or run the verb from a terminal where a person can confirm.`,
              code: "RT_E_VALIDATION",
              remedy:
                "Name exactly one seat: `--seat autopilot` (explicit machine attribution, works non-TTY) or `--i-am-human` from an interactive terminal (human seat, typed token re-entry).",
            },
            1,
          );
        }
        const humanSeat = flag(args, "i-am-human") ? await humanSeatClaim("reject") : null;
        if (humanSeat && humanSeat.error !== undefined) {
          return respond({ ok: false, error: humanSeat.error, code: "RT_E_VALIDATION" }, 1);
        }
        const updated = h.reject(project, note.value, humanSeat ? humanSeat.actor : { decidedBy: "autopilot", seat: "harness" });
        h.saveProject(requireProjectPath(args, "reject"), updated);
        respond({ ok: true, path: requireProjectPath(args, "reject"), summary: h.summary(updated) }, 0);
        return;
      }

      case "retry": {
        const project = loadProjectFor("retry");
        if (project.status !== "blocked") {
          return respond(
            {
              ok: false,
              error: `Nothing to retry (status: ${project.status}) — retry applies to rejected/blocked projects.`,
              code: "RT_E_PHASE_ILLEGAL",
            },
            1,
          );
        }
        const updated = h.retry(project);
        h.saveProject(requireProjectPath(args, "retry"), updated);
        respond({ ok: true, path: requireProjectPath(args, "retry"), summary: h.summary(updated) }, 0);
        return;
      }

      case "ingest": {
        const project = loadProjectFor("ingest");
        const reportArg = requireArg(args, "report", "ingest");
        if (reportArg.error !== undefined) return respond({ ok: false, error: reportArg.error, code: "RT_E_VALIDATION" }, 1);
        let reportText;
        try {
          reportText = await readReportSource(reportArg.value);
        } catch (err) {
          return respond(
            {
              ok: false,
              error: `ingest: cannot read --report source: ${err instanceof Error ? err.message : String(err)}`,
              ...errCode(err, "RT_E_PROJECT_MISSING"),
            },
            1,
          );
        }
        let report;
        try {
          report = JSON.parse(reportText);
        } catch (err) {
          return respond(
            {
              ok: false,
              error: `ingest: --report is not valid JSON: ${err.message}`,
              code: "RT_E_REPORT_INVALID",
            },
            1,
          );
        }
        const path = requireProjectPath(args, "ingest");
        try {
          // E-09: the RICH ingest surfaces whether the report actually landed —
          // a duplicate retry (lost-ack recovery) is success with applied:false,
          // never a fabricated applied:true.
          const res = h.ingestResult(project, report);
          h.saveProject(path, res.project);
          respond(
            { ok: true, path, summary: h.summary(res.project), applied: res.applied, reason: res.reason },
            0,
          );
        } catch (err) {
          // E-10: a rejected report (wrong phase, malformed payload) throws
          // ReportRejectedError carrying the project with its report.rejected
          // trail log — persist the trail, then exit 1 (validation class).
          if (err && typeof err === "object" && err.name === "ReportRejectedError" && err.project) {
            try {
              h.saveProject(path, err.project);
            } catch (saveErr) {
              console.error(saveErr instanceof Error && saveErr.stack ? saveErr.stack : String(saveErr));
              return respond(
                {
                  ok: false,
                  error: `${err.message} (note: could not persist the rejection trail)`,
                  ...errCode(saveErr, "RT_E_INTERNAL"),
                },
                4,
              );
            }
            return respond(
              { ok: false, error: err.message, rejected: true, ...errCode(err, "RT_E_REPORT_INVALID") },
              1,
            );
          }
          throw err;
        }
        return;
      }

      case "packet": {
        const project = loadProjectFor("packet");
        // fixes/144 (M5-3): optional `--knowledge <store.json>` enables the
        // tier-1 Ranked-memory seed — cross-project proven lesson rows from
        // the configured store join the packet's fusionRank pool (advisory,
        // human-accepted rows only). Requires a LIVE re-compile through
        // packet.ts (exportPacketText would serve the pre-stamped packet);
        // without the flag the verb is byte-identical to h.packet.
        //
        // R5-f10 (W29 · A2-f11): a valueless `--out` must never melt away into
        // the stdout default — parseArgs turns a bare flag into `true`, which
        // `typeof args.out === "string"` silently ignores. Refuse loudly.
        if (pathFlagMissing(args.out)) {
          return respond(
            { ok: false, error: pathFlagRefusalError("packet", "out", args.out), code: "RT_E_VALIDATION" },
            1,
          );
        }
        // 330 Switchboard (probed): the same R5-f10 class for `--knowledge` —
        // a bare `packet --knowledge` parses to `true`, so the
        // `typeof args.knowledge === "string"` read below silently ignored the
        // flag and served the unseeded packet (a knowledge flag that appears to
        // apply but does not). Refuse it loudly, naming the flag.
        if (pathFlagMissing(args.knowledge)) {
          return respond(
            {
              ok: false,
              error: pathFlagRefusalError("packet", "knowledge", args.knowledge),
              code: "RT_E_VALIDATION",
            },
            1,
          );
        }
        let text;
        if (typeof args.knowledge === "string" && args.knowledge.trim()) {
          try {
            const k = await knowledgeDriver();
            // 329: use the knowledge module's OWN store->rows resolver instead of
            // a second copy of it here. 328 P5 found `provenRowsFromStore` had NO
            // production caller while this arm reimplemented it inline (and used
            // injectProven directly, so a read failure could only throw). The
            // helper additionally reports a DEGRADED read (reason + code) that
            // this arm surfaces as the same coded refusal it always returned.
            const resolved = k.provenRowsFromStore(resolve(args.knowledge), project.name, {
              limit: k.EXPAND_LESSON_RANK_LIMIT,
            });
            if (resolved.degraded) {
              return respond(
                {
                  ok: false,
                  error: `packet: cannot seed tier-1 lessons from ${args.knowledge}: ${resolved.reason ?? "the store could not be read"}`,
                  code: resolved.code ?? "RT_E_INTERNAL",
                },
                4,
              );
            }
            const pkt = await packetDriver();
            text = pkt.compileAgentPacket(project, { proven: resolved.rows });
          } catch (err) {
            return respond(
              {
                ok: false,
                error: `packet: cannot seed tier-1 lessons from ${args.knowledge}: ${err instanceof Error ? err.message : String(err)}`,
                ...errCode(err, "RT_E_INTERNAL"),
              },
              4,
            );
          }
        } else {
          text = h.packet(project);
        }
        if (typeof args.out === "string") {
          const out = resolve(args.out);
          mkdirSync(dirname(out), { recursive: true });
          writeFileSync(out, text, "utf8");
          respond({ ok: true, path: out, bytes: Buffer.byteLength(text, "utf8") }, 0);
        } else {
          respond({ ok: true, packet: text }, 0);
        }
        return;
      }

      case "export": {
        const project = loadProjectFor("export");
        // R5-f10 (W29 · A2-f11): valueless --out guard (see packet).
        if (pathFlagMissing(args.out)) {
          return respond(
            { ok: false, error: pathFlagRefusalError("export", "out", args.out), code: "RT_E_VALIDATION" },
            1,
          );
        }
        const json = h.exportJson(project);
        if (typeof args.out === "string") {
          const out = resolve(args.out);
          mkdirSync(dirname(out), { recursive: true });
          writeFileSync(out, json, "utf8");
          respond({ ok: true, path: out, summary: h.summary(project) }, 0);
        } else {
          respond({ ok: true, summary: h.summary(project), project: JSON.parse(json) }, 0);
        }
        return;
      }

      case "emit": {
        // fixes/126: CODE → RUNNABLE-APP path — write the scaffolded project
        // (with the generated module embedded) to --out. No build step: the
        // scaffold emits runnable package.json/tsconfig for the caller.
        // fixes/132 (C2): optional `--check` runs the per-file compile-check
        // seam over the just-emitted dir and reports one verdict per file.
        const project = loadProjectFor("emit");
        try {
          // fixes/144 (M1): default = findable <home>/RapidTool Software/<slug>/
          // (per-project; CWD fallback when the home location is unwritable);
          // --out keeps overriding. headless.emitProject mkdirSync(recursive)s
          // the target AND every file's parent before writeFileSync (headless.ts
          // emitProject) — no extra mkdir needed here.
          if (pathFlagMissing(args.out)) {
            return respond(
              { ok: false, error: pathFlagRefusalError("emit", "out", args.out), code: "RT_E_VALIDATION" },
              1,
            );
          }
          // W14-L2 (OV-15): expose headless.emitProject's own `redTree` policy so
          // the coded refusal's advice — 'emit with redTree:"banner"' — is
          // reachable from the CLI. `refuse` (the default) and `banner` (emit
          // anyway, with the unmissable banner prepended to the emitted
          // README.md) are accepted; `probe` (no trail read) stays internal to
          // the eval driver / journey paths and is NOT exposed here.
          const redTree = args["red-tree"];
          if (redTree !== undefined && redTree !== "refuse" && redTree !== "banner") {
            return respond(
              {
                ok: false,
                error: `emit --red-tree expects "refuse" or "banner" (got ${JSON.stringify(redTree)})`,
                code: "RT_E_VALIDATION",
              },
              1,
            );
          }
          // R11-f13 (W29 LANE H · A2-f11 re-verified): `--force` is a BOOLEAN
          // flag; a stray value used to be swallowed by parseArgs so the flag
          // silently read as absent — the value counterpart of the valueless
          // `--out` guard above. Accept the boolean spellings only and refuse
          // the rest loudly: never a silent no-force.
          if (typeof args.force === "string" && !["true", "1", "false", "0"].includes(args.force)) {
            return respond(
              {
                ok: false,
                error: `emit --force is a boolean flag (got ${JSON.stringify(args.force)}) — pass it bare (--force) or as --force=true|1|false|0`,
                code: "RT_E_VALIDATION",
              },
              1,
            );
          }
          const dest = typeof args.out === "string" ? { path: args.out, fallback: false, error: null } : defaultOutputDir(h, project);
          const dir = dest.path;
          const target = resolve(dir);
          // fixes/144 (M1): a second emit must overwrite cleanly and SAY so —
          // never a silent merge. Snapshot pre-existing content BEFORE writing
          // (writeFileSync replaces each file wholesale; nothing is merged).
          const preExisting = existsSync(target) && readdirSync(target).length > 0;
          const res = await h.emitProject(project, target, {
            force: flag(args, "force"),
            ...(typeof redTree === "string" ? { redTree } : {}),
          });
          if (!res.ok) {
            respond({ ok: false, error: res.error, code: res.code ?? "RT_E_VALIDATION", foreign: res.foreign, ...(res.quarantineFailed ? { quarantineFailed: res.quarantineFailed, judgingSkipped: res.judgingSkipped } : {}) }, 1);
            return;
          }
          const payload = {
            ok: true,
            dir: res.dir,
            count: res.files.length,
            moduleEmbedded: res.moduleEmbedded,
            summary: res.summary,
          };
          if (Array.isArray(res.quarantined)) { payload.quarantined = res.quarantined; payload.quarantineDir = res.quarantineDir; if (res.quarantineMissing?.length) payload.quarantineMissing = res.quarantineMissing; }
          // W14-L2 (OV-15): under --red-tree banner the emitted tree carries the
          // unmissable README banner — say so on the envelope too, so an agent
          // driver can never read this as a quietly-clean emit.
          if (res.redTreeBanner === true) {
            payload.redTreeBanner = true;
            payload.redTree = res.redTree ?? null;
          }
          if (dest.fallback) {
            payload.fallback = true;
            payload.warning =
              `Home emit dir was unwritable (${dest.error ?? "unknown"}) — wrote under CWD instead: ${res.dir}`;
          }
          if (preExisting) {
            payload.overwritten = true;
            payload.warning =
              "Output folder already existed — its files were overwritten in place (writeFileSync replaces whole files; nothing was merged or appended).";
          }
          // R11-f08 (W42 · L4/E4): a forced emit no longer leaves the foreign
          // survivors in place — move them ASIDE into
          // `<dir>/.rapidtool-quarantine/<stamp>/` (recoverable, never a
          // delete) and report it. Runs BEFORE --check/--run so those legs
          // judge the intended tree only (A1-f07: the "tested" tree must not
          // be a mixed tree). A failed move flips the envelope ok:false +
          // RT_E_FOREIGN_FILES — the module never silently drops (R11-f08).
          // A FAILED move means the survivors are STILL in the dir, so the
          // judging legs below are suppressed (foreignLeftInPlace): a green
          // --run over a mixed tree would otherwise mint `tested` over bytes
          // the factory never authored — the exact A1-f07 defect the move
          // exists to prevent.
          let foreignLeftInPlace = false;
          if (Array.isArray(res.survivors) && res.survivors.length > 0) {
            const q = await quarantineDriver();
            const moved = await q.quarantineFiles(target, res.survivors);
            payload.quarantined = moved.moved;
            payload.quarantineDir = moved.quarantineDir;
            if (moved.missing.length > 0) payload.quarantineMissing = moved.missing;
            if (!moved.ok) {
              payload.ok = false;
              payload.quarantineFailed = moved.failed;
              payload.error =
                "quarantine move failed: " +
                moved.failed.map((f) => `${f.path} (${f.error})`).join(", ");
              payload.code = "RT_E_FOREIGN_FILES";
              foreignLeftInPlace = true;
            }
          }
          if (foreignLeftInPlace) {
            payload.judgingSkipped =
              "foreign files could not be quarantined — --verify-kind/--check/--run did not run (the tree is still mixed; R11-f08 · A1-f07)";
          }
          if (!foreignLeftInPlace && flag(args, "verify-kind")) {
            const cc = await checkDriver();
            // fixes/216z (T4.1 / TA-16): the leg is async — scratch-copy npm
            // ci/install + the tree's declared build/test under the bounded
            // runner (compile-check.server.ts: verifyKindDir).
            const vk = await cc.verifyKindDir(res.dir);
            payload.verifyKind = vk;
            if (!vk.ok) {
              payload.ok = false;
              payload.error = vk.detail ?? "verify-kind failed";
              payload.code = "RT_E_VERIFY_KIND_FAILED";
            }
          }
          if (!foreignLeftInPlace && flag(args, "check")) {
            const cc = await checkDriver();
            const check = cc.compileCheckDir(res.dir);
            payload.check = check;
            if (!check.ok) {
              // Emit itself succeeded, but the emitted code does not all
              // parse — surface the verdicts and exit 1 (loud, never a
              // faked all-clear).
              payload.ok = false;
              payload.error = `${check.failed} of ${check.checked} emitted files failed compile-check`;
              payload.code = "RT_E_CHECK_FAILED";
            }
          }
          // fixes/144 (M3/B3): optional `--run` executes the emitted tree
          // in-loop — per-file parse verdicts + every emitted tests/*.spec.ts
          // under the bounded runner + one kind-entry smoke — and appends the
          // TreeRunOutcome (compile/tests/run). Exit 1 when the tree is not
          // ok (red tree is never a clean emit — loud, never a faked pass).
          if (!foreignLeftInPlace && flag(args, "run")) {
            const cc = await checkDriver();
            const outcome = await cc.treeRun(res.dir);
            payload.treeRun = outcome;
            // W43 · C6/E4 (fixes/312_c6_ux · 311_sd_product K3): self-qualification —
            // a green --run must never read as "the product works" while the census
            // shows stubs/reexports. The envelope carries the census in the doctor's
            // own vocabulary (`stubs:N reexports:N real:N`) plus the verdict's loud
            // marking, so the agent sees the same words `tree-run` would print and
            // the emitted README's own claims stay checkable from the envelope.
            if (outcome.substance) {
              payload.substance = {
                stubs: outcome.substance.stubs,
                reexports: outcome.substance.reexports,
                real: outcome.substance.real,
                verdict: outcome.substance.verdict,
                greenWhileStubbed: outcome.substance.greenWhileStubbed,
              };
              if (outcome.substance.note) payload.note = outcome.substance.note;
            }
            if (!outcome.ok) {
              payload.ok = false;
              const bits = [];
              if (typeof outcome.error === "string" && outcome.error.length > 0) bits.push(outcome.error);
              const specFails = outcome.tests.filter((t) => t.run !== "pass");
              if (specFails.length > 0) {
                const first = specFails[0];
                bits.push(
                  `spec ${first.file}: ${first.run}` +
                    (first.detail ? ` — ${first.detail.slice(0, 300)}` : ""),
                );
              }
              if (outcome.run && outcome.run.run !== "pass" && outcome.run.run !== "skip") {
                bits.push(
                  `entry ${outcome.run.entry ?? outcome.run.kind}: ${outcome.run.run}` +
                    (outcome.run.detail ? ` — ${outcome.run.detail.slice(0, 300)}` : ""),
                );
              }
              payload.error = bits.length > 0 ? bits.join("; ") : "tree-run failed";
              payload.code = "RT_E_TREE_RUN_FAILED";
            }
            // W48 · 334-4 (S2): an `ok` tree whose DECLARED scripts (typecheck /
            // build) never executed is GREEN BUT UNVERIFIED — nothing ran red,
            // so `ok` is NOT redefined and the P6 mint below is untouched. The
            // exit taxonomy (5) and these top-level fields make the unverified
            // toolchain distinguishable from a fully-verified tree.
            if (typeof outcome.declaredScriptsVerified === "boolean") {
              payload.declaredScriptsVerified = outcome.declaredScriptsVerified;
            }
            if (Array.isArray(outcome.unverifiedDeclaredScripts) && outcome.unverifiedDeclaredScripts.length > 0) {
              payload.unverified = true;
              payload.unverifiedDeclaredScripts = [...outcome.unverifiedDeclaredScripts];
              payload.unverifiedNote =
                "declared project script(s) did not execute — the emitted tree is ok (nothing ran red) but its toolchain is UNVERIFIED; install deps and re-run --run to verify";
            }
            // T9.3 promotion (W44 · G3 · applied from fixes/319_f3_promote §C):
            // a GREEN --run earns the tested stamp onto the emitted artifact
            // ITSELF — the dir's own `.rapidtool/project.json` now carries
            // label:"tested" + evidenceHash from THIS verdict. The mint
            // self-guards (red / ok-but-no-spec runs promote nothing; an
            // existing stamp is never rewritten). The ledger absorbs the
            // promotion (repair parity), so a future re-emit never downgrades
            // the record.
            if (outcome.ok === true) {
              const prom = await h.promoteEmittedTreeTested(project, res.dir, outcome);
              if (prom.promoted) {
                const lt = prom.project.lastTest;
                payload.tested = {
                  promoted: true,
                  label: "tested",
                  evidenceHash: lt && typeof lt.evidenceHash === "string" ? lt.evidenceHash : null,
                };
                if (typeof args.project === "string" && args.project.trim()) {
                  try {
                    h.saveProject(args.project, prom.project);
                    payload.tested.ledgerSaved = true;
                  } catch {
                    payload.tested.ledgerSaved = false;
                  }
                }
              }
            }
          }
          // W48 · 334-4 (S2) introduced exit 5 for a green-but-unverified tree;
          // W49 · 335-4 flipped it to OPT-IN (`--require-verified`). A fresh
          // scaffold has no `node_modules`, so its declared toolchain is ALWAYS
          // unverified — a default that never exits 0 is not a usable pass/fail
          // for an agent or a human. The DEFAULT is now 0 for a green tree; the
          // envelope still carries `unverified` / `declaredScriptsVerified` /
          // `unverifiedDeclaredScripts`, so the honest signal is preserved and a
          // hard gate passes --require-verified to get exit 5.
          // fixes/343_3 · git-native delivery: `emit --git` lands the just-
          // emitted tree as ONE Conventional-Commits commit through
          // headless.landEmittedTree → git.server's §6b seam (emitted-product
          // only, manifest-only staging, the host repo structurally refused,
          // idempotent). The envelope carries the REAL commit; a land refusal
          // is coded and flips payload.ok false (exit 1) — the emitted tree
          // still exists on disk either way.
          if (flag(args, "git")) {
            const landed = await h.landEmittedTree(project, res.dir, { files: res.files });
            payload.git = landed.ok
              ? {
                  dir: landed.dir,
                  message: landed.message,
                  committed: landed.committed,
                  noop: landed.noop,
                  commit: landed.commit,
                  files: landed.files,
                  foreign: landed.foreign,
                }
              : { ok: false, reason: landed.reason, code: landed.code ?? "RT_E_INTERNAL", error: landed.error };
            if (!landed.ok) {
              payload.ok = false;
              payload.code = landed.code ?? "RT_E_INTERNAL";
              if (typeof payload.error !== "string") payload.error = landed.error;
            }
          }
          respond(
            payload,
            payload.ok ? (payload.unverified === true && flag(args, "require-verified") ? 5 : 0) : 1,
          );
        } catch (err) {
          respond(
            { ok: false, error: err instanceof Error ? err.message : String(err), ...errCode(err, "RT_E_INTERNAL") },
            4,
          );
        }
        return;
      }

      case "fixtures": {
        const project = loadProjectFor("fixtures");
        try {
          const bf = await import("../src/lib/brief-fixtures.ts");
          const { fnv1a } = await import("../src/lib/algorithms.ts");
          const outPath = typeof args.project === "string" ? args.project : "";
          if (flag(args, "draft")) {
            const oracle = Array.isArray(project.oracle) ? project.oracle : [];
            const caps = Array.isArray(project.implementationSpec?.requirements)
              ? project.implementationSpec.requirements
              : [];
            const typed = bf.draftTypedLiterals({ oracle, capabilities: caps });
            const draft = bf.draftBriefFixtures({ oracle, capabilities: caps, typed });
            const merged = bf.mergeDraftedFixtures(project.acceptanceFixtures, draft.cases);
            const next = {
              ...project,
              acceptanceFixtures: merged,
              acceptanceBriefHash: String(fnv1a(project.brief ?? "")),
            };
            // R5-f09 (W29 · A2-f10): the stamp must AGREE with the rows — a
            // blanket delete broke surviving approved rows of their stamp
            // (hydration demotes approved rows on a brief-hash change; readers
            // treat the pair as one fact). Keep it iff approved rows survive
            // the merge AND the prior value was a real finite number.
            const keptApproved = merged.some((c) => c.approval === "approved");
            const priorStamp = project.acceptanceApprovedAt;
            if (!keptApproved || typeof priorStamp !== "number" || !Number.isFinite(priorStamp)) {
              delete next.acceptanceApprovedAt;
            }
            h.saveProject(outPath, next);
            // OPS-1 (W36 · N5): this envelope used respond()'s 1-arg form, so
            // `exit_code` was left undefined and JSON.stringify dropped the key
            // entirely (F5's scan: exactly 2 of 177 call sites). Every CLI
            // envelope carries `exit_code`; the draft landed, so exit 0.
            respond(
              {
                ok: true,
                drafted: draft.cases.length,
                redCards: draft.redCards,
                pending: merged.filter((c) => c.approval === "pending").length,
                approvedKept: merged.filter((c) => c.approval === "approved").length,
                note: "draft is pending — run fixtures --approve --ids … or --approve-all (never auto)",
              },
              0,
            );
            return;
          }
          if (flag(args, "approve") || flag(args, "approve-all")) {
            const current = Array.isArray(project.acceptanceFixtures) ? project.acceptanceFixtures : [];
            const ids = flag(args, "approve-all")
              ? current.map((c) => c.id)
              : String(args.ids ?? "")
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);
            if (ids.length === 0) {
              respond({ ok: false, error: "fixtures --approve needs --ids id1,id2 or --approve-all", code: "RT_E_VALIDATION" }, 1);
              return;
            }
            // R5-f02 (W29 · A2-f01 · R11-f05): the acceptance approval is a
            // HUMAN decision — route it through the ONE policy seam
            // (`fixtures.approve`, requiresHumanSeat) exactly like `approve`
            // does for a gate. The seat is the two-channel claim (R5-f12): a
            // non-TTY --i-am-human is refused up front; a denied verdict (e.g.
            // the autopilot seat, which may never self-approve) writes NOTHING
            // and returns the reason + sanctioned fallback. The README's
            // "drafted cases stay pending until a human approves" is now the
            // enforced truth.
            const { evaluatePolicy, seatLabel } = await import("../src/lib/policy.ts");
            const humanSeat = flag(args, "i-am-human") ? await humanSeatClaim("fixtures") : null;
            if (humanSeat && humanSeat.error !== undefined) {
              respond({ ok: false, error: humanSeat.error, code: "RT_E_VALIDATION" }, 1);
              return;
            }
            const actor = humanSeat ? humanSeat.actor : { decidedBy: "autopilot", seat: "harness" };
            const policyVerdict = evaluatePolicy("fixtures.approve", `fixtures:${outPath}`, {
              actor,
              humanSeatToken: humanSeat ? humanSeat.humanSeatToken : undefined,
              expectedHumanSeatToken: humanSeat ? humanSeat.expectedHumanSeatToken : undefined,
            });
            if (policyVerdict.decision !== "allow") {
              respond(
                {
                  ok: false,
                  error:
                    `fixtures: refused by the policy seam — ${policyVerdict.reason} ` +
                    `(sanctioned fallback: ${policyVerdict.fallback}); nothing was written. ` +
                    `A human approves with --i-am-human from a terminal (re-enter RT_HUMAN_SEAT_TOKEN at the prompt).`,
                  code: "RT_E_VALIDATION",
                  policy: {
                    action: "fixtures.approve",
                    resource: `fixtures:${outPath}`,
                    decision: "deny",
                    reason: policyVerdict.reason,
                    fallback: policyVerdict.fallback,
                  },
                },
                1,
              );
              return;
            }
            // Provenance comes from the VERDICT's seat, never from the flag
            // alone: only the verified human-seat reason stamps "human"; the
            // autopilot seat (allowed by a future non-requiresHumanSeat rule)
            // would stamp "autopilot".
            const decidedBy = policyVerdict.reason.startsWith("human-seat-token-verified") ? "human" : "autopilot";
            const approved = bf.approveFixtureCases(current, ids, { decidedBy });
            // R5-f09 (the approve half of the pair predicate): stamp Date.now()
            // only when an approved row is on disk after the flip; otherwise
            // drop a stamp that no longer describes the rows.
            const stamped = approved.some((c) => c.approval === "approved");
            const next = { ...project, acceptanceFixtures: approved };
            if (stamped) next.acceptanceApprovedAt = Date.now();
            else delete next.acceptanceApprovedAt;
            h.saveProject(outPath, next);
            // OPS-1 (W36 · N5): second and last 1-arg respond() in the file —
            // `exit_code` was silently dropped from this envelope. The approval
            // landed (seat-verified or autopilot per the seam verdict), exit 0.
            respond(
              {
                ok: true,
                approved: ids,
                decidedBy,
                decidedVia: {
                  action: "fixtures.approve",
                  resource: `fixtures:${outPath}`,
                  reason: policyVerdict.reason,
                  label: seatLabel(actor),
                  tokenPath: decidedBy === "human",
                },
                pending: approved.filter((c) => c.approval === "pending").length,
              },
              0,
            );
            return;
          }
          respond({ ok: false, error: "fixtures requires --draft or --approve", code: "RT_E_VALIDATION" }, 1);
        } catch (err) {
          respond(
            { ok: false, error: err instanceof Error ? err.message : String(err), ...errCode(err, "RT_E_INTERNAL") },
            4,
          );
        }
        return;
      }

      case "eval": {
        // T5.3 (fixes/262 LANE 5 · W23): READ-ONLY scorecard over the keyed-eval
        // harness's own documents under research/eval-out (results.json +
        // history.json + the W16-L1 kill-safety run marker). Prints ONE JSON
        // object: the M1–M9 rubric (per-criterion aggregates + verbatim
        // evidence), one row per corpus case (criteria / acceptance / grader
        // facts / coverage gaps), the history deltas (the LAST recorded history
        // row per slug vs the current results row) and the per-slug trend.
        //
        // READ-ONLY over the eval documents (R5-f04 · W29 · A2-f04 narrowed
        // this from the old broad claim): never writes results.json /
        // history.json / run-in-progress.json, no decision-ledger rows, no
        // DEEPSEEK_API_KEY touch, no network, no model call — the reader is a
        // pure parse+build over bytes already on disk. But like EVERY verb,
        // this exit stamps one NDJSON telemetry row under <cwd>/.rapidtool/logs/
        // (the respond() contract). Exit taxonomy: 0 = the scorecard printed;
        // 1 = usage/validation class (no readable/malformed results.json,
        // unknown --slug) carrying RT_E_VALIDATION; 4 = RT_E_INTERNAL only if
        // the reader itself throws. Exit 3 is unreachable by design — this verb
        // has no keyed path to be "not configured".
        const envDir =
          typeof process.env.EVAL_OUT_DIR === "string" && process.env.EVAL_OUT_DIR.trim() !== ""
            ? resolve(process.env.EVAL_OUT_DIR)
            : null;
        const dir =
          typeof args.dir === "string" && args.dir.trim() !== ""
            ? resolve(args.dir)
            : envDir ?? EVAL_OUT_DIR;
        const slug =
          typeof args.slug === "string" && args.slug.trim() !== "" ? args.slug.trim() : null;
        try {
          const sc = await scorecardDriver();
          const resultsPath = join(dir, "results.json");
          // --history overrides just the trend document (a scratch history file
          // for a scratch eval-out dir); the default is <dir>/history.json.
          const historyPath =
            typeof args.history === "string" && args.history.trim() !== ""
              ? resolve(args.history)
              : join(dir, "history.json");
          const markerPath = join(dir, "run-in-progress.json");
          const readText = (p) => {
            try {
              return { ok: true, text: readFileSync(p, "utf8") };
            } catch (err) {
              return { ok: false, error: err instanceof Error ? err.message : String(err) };
            }
          };

          const resultsRead = readText(resultsPath);
          if (!resultsRead.ok) {
            return respond(
              {
                ok: false,
                dir,
                error: `eval: no readable results.json under ${dir} (${resultsRead.error}) — run the harness first (npm run eval / scripts/run-eval.mjs); this verb never fabricates a scorecard`,
                code: "RT_E_VALIDATION",
              },
              1,
            );
          }
          const parsed = sc.parseEvalResults(resultsRead.text);
          if (!parsed.ok) {
            return respond(
              { ok: false, dir, error: `eval: ${resultsPath}: ${parsed.error}`, code: "RT_E_VALIDATION" },
              1,
            );
          }
          const results = parsed.value;
          if (slug && !results.entries.some((e) => e.slug === slug)) {
            const known = results.entries.map((e) => e.slug);
            return respond(
              {
                ok: false,
                dir,
                error: `eval: unknown --slug ${JSON.stringify(slug)} — results.json carries: ${
                  known.length > 0 ? known.join(", ") : "(no entries)"
                }`,
                code: "RT_E_VALIDATION",
              },
              1,
            );
          }

          // history + marker are ADVISORY context: a missing or malformed one
          // degrades to an honest note (deltas/trend unavailable) — it never
          // hides the scorecard, and it is never turned into a fake delta.
          const historyRead = readText(historyPath);
          let historyRows = [];
          let historyPresent = false;
          let historyProblem = null;
          if (historyRead.ok) {
            const hp = sc.parseEvalHistory(historyRead.text);
            if (hp.ok) {
              historyRows = hp.value;
              historyPresent = true;
            } else {
              historyProblem = `${historyPath}: ${hp.error}`;
            }
          }
          const markerRead = readText(markerPath);
          let marker = null;
          let markerProblem = null;
          if (markerRead.ok) {
            const mp = sc.parseEvalRunMarker(markerRead.text);
            if (mp.ok) marker = mp.value;
            else markerProblem = `${markerPath}: ${mp.error}`;
          }

          const scorecard = sc.buildScorecard({
            results,
            history: historyRows,
            historyPresent,
            marker,
            dir,
            resultsPath,
            historyPath,
            runMarkerPath: markerPath,
            slug,
          });
          const notes = [...scorecard.notes];
          if (historyProblem) {
            notes.push(`history.json unreadable — ${historyProblem} (deltas/trend unavailable; never fabricated).`);
          }
          if (markerProblem) {
            notes.push(`run-in-progress.json unreadable — ${markerProblem}`);
          }
          respond({ ...scorecard, notes, trends: sc.buildTrends(historyRows) }, 0);
        } catch (err) {
          respond(
            {
              ok: false,
              error: `eval: ${err instanceof Error ? err.message : String(err)}`,
              ...errCode(err, "RT_E_INTERNAL"),
            },
            4,
          );
        }
        return;
      }

      case "tree-run": {
        // fixes/149 P0-1 (150-G1): the emit→edit→re-emit seam's ORACLE — run
        // compile-check's dir-based treeRun over an EXISTING emitted dir.
        // NO re-emit, NO writes before/during reading: the dir is read exactly
        // as the agent left it (the emit-then-run ordering of `emit --run`
        // above is precisely what made hand-edits unreachable — this verb
        // never clobbers). Green tree → exit 0; red tree → exit 1 with the
        // first not-ok tail (top-level error, then first failing spec, then
        // the entry verdict) in the envelope. Optional --project loads the
        // project ledger for a READ-ONLY hash-checked divergence report
        // (`dirDirty`: which tree files differ from the ledger) — nothing is
        // ever persisted by this verb.
        const dirArg = requireArg(args, "dir", "tree-run");
        if (dirArg.error !== undefined) return respond({ ok: false, error: dirArg.error, code: "RT_E_VALIDATION" }, 1);
        try {
          const dir = resolve(dirArg.value);
          const cc = await checkDriver();
          const outcome = await cc.treeRun(dir);
          const payload = { ok: outcome.ok === true, dir, treeRun: outcome };
          if (typeof args.project === "string" && args.project.trim()) {
            // Advisory ledger context — a broken/unrelated ledger must never
            // hide the tree verdict, so the report is best-effort.
            try {
              const project = loadProjectFor("tree-run");
              const imp = h.importTreeDir(project, dir);
              payload.dirDirty = {
                changed: imp.changed,
                unchanged: imp.unchanged.length,
                missing: imp.missing,
                refused: imp.refused,
                warnings: imp.warnings,
              };
            } catch (e) {
              // W42 L4-G7 (OPS-12 / A-58): the divergence report stays
              // advisory (verdict + exit are never changed by it), but a
              // failed ledger read is no longer SILENT — the envelope names
              // why the report is absent (message bounded to 200 chars).
              payload.dirDirtyNote =
                "ledger read failed — divergence report skipped: " +
                (e instanceof Error ? e.message : String(e)).slice(0, 200);
            }
          }
          if (outcome.ok !== true) {
            payload.ok = false;
            const bits = [];
            if (typeof outcome.error === "string" && outcome.error.length > 0) bits.push(outcome.error);
            const specFails = outcome.tests.filter((t) => t.run !== "pass");
            if (specFails.length > 0) {
              const first = specFails[0];
              bits.push(
                `spec ${first.file}: ${first.run}` +
                  (first.detail ? ` — ${first.detail.slice(0, 300)}` : ""),
              );
            }
            if (outcome.run && outcome.run.run !== "pass" && outcome.run.run !== "skip") {
              bits.push(
                `entry ${outcome.run.entry ?? outcome.run.kind}: ${outcome.run.run}` +
                  (outcome.run.detail ? ` — ${outcome.run.detail.slice(0, 300)}` : ""),
              );
            }
            payload.error = bits.length > 0 ? bits.join("; ") : "tree-run failed";
            payload.code = "RT_E_TREE_RUN_FAILED";
          }
          // W48 · 334-4 (S2): same unverified-toolchain signal as `emit --run` —
          // the envelope fields below are always present; W49 · 335-4 made the
          // exit for that state OPT-IN (`--require-verified`), default 0.
          if (typeof outcome.declaredScriptsVerified === "boolean") {
            payload.declaredScriptsVerified = outcome.declaredScriptsVerified;
          }
          if (Array.isArray(outcome.unverifiedDeclaredScripts) && outcome.unverifiedDeclaredScripts.length > 0) {
            payload.unverified = true;
            payload.unverifiedDeclaredScripts = [...outcome.unverifiedDeclaredScripts];
            payload.unverifiedNote =
              "declared project script(s) did not execute — the tree is ok (nothing ran red) but its toolchain is UNVERIFIED; install deps and re-run to verify";
          }
          respond(
            payload,
            payload.ok ? (payload.unverified === true && flag(args, "require-verified") ? 5 : 0) : 1,
          );
        } catch (err) {
          respond(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
              ...errCode(err, "RT_E_INTERNAL"),
            },
            4,
          );
        }
        return;
      }

      case "repair": {
        // fixes/149 P0-1 (150-G1): the emit→edit→re-emit continuation seam —
        // bounded repair of an EDITED emitted dir. Loads the project ledger,
        // re-imports the edited tree files from the dir into
        // project.generatedTree (path→content, per-file hash — a new hash is
        // a real edit; refused/missing paths are warnings, never silent
        // drops), then runs the journey's bounded repair cycle AGAINST the
        // dir: treeRun(dir) → red tail → one bounded synthesis repair call
        // whose context reaches codegen as deps.treeFailure (the driveP6Journey
        // seam) → the repaired tree files are applied onto the dir in place →
        // re-import → treeRun again. Green → the tested-equivalent mint + the
        // honest P6 gate record + converged (exit 0). Budget exhausted →
        // honest FAILED (exit 1) with the deterministic floor standing. The
        // dir is NEVER re-emitted over (it is the artifact; the project JSON
        // is the ledger — the ledger is persisted after every completed run,
        // converged or failed, so the artifact edits are never lost).
        const dirArg = requireArg(args, "dir", "repair");
        if (dirArg.error !== undefined) return respond({ ok: false, error: dirArg.error, code: "RT_E_VALIDATION" }, 1);
        const project = loadProjectFor("repair");
        const path = requireProjectPath(args, "repair");
        const budget =
          typeof args.budget === "string" && /^\d+$/.test(args.budget)
            ? parseInt(args.budget, 10)
            : h.P6_JOURNEY_DEFAULT_BUDGET;
        if (!Number.isInteger(budget) || budget < 1) {
          return respond(
            {
              ok: false,
              error: `repair: --budget must be a positive integer (got ${String(args.budget)})`,
              code: "RT_E_VALIDATION",
            },
            1,
          );
        }
        try {
          const res = await h.repairTreeDir(project, resolve(dirArg.value), { budget, checkpointDir: dirname(resolve(path)) });
          const importSummary = {
            imported: res.import.imported.length,
            changed: res.import.changed,
            unchanged: res.import.unchanged.length,
            missing: res.import.missing,
            refused: res.import.refused,
            warnings: res.import.warnings,
          };
          if (res.ok) {
            h.saveProject(path, res.project); // the ledger absorbs the dir edits
            // T9.3 repair-dir variant (fixes/323 FIX-2c · 319_f3_promote §C4):
            // the converged repair's FRESH mint is the caller attestation —
            // promote the dir's OWN `.rapidtool/project.json` with the tested
            // evidence THIS run earned. repairTreeDir mints on the LEDGER
            // internally (recordGreen runs before the CLI sees the result), so
            // promoteEmittedTreeTested's fresh-mint guard can never fire here;
            // res.minted is true only when this repair flipped the label —
            // a red/no-spec run reports false and writes nothing.
            const promotedTree = h.promoteRepairedDirTested(res.project, res.dir, res.minted === true);
            return respond(
              {
                ok: true,
                path,
                outcome: res.outcome,
                dir: res.dir,
                cycles: res.cycles,
                budget: res.budget,
                treeRun: res.treeRun,
                minted: res.minted,
                gate: res.gate,
                import: importSummary,
                ...(promotedTree.promoted
                  ? {
                      tested: {
                        promoted: true,
                        label: "tested",
                        evidenceHash:
                          res.project.lastTest && typeof res.project.lastTest.evidenceHash === "string"
                            ? res.project.lastTest.evidenceHash
                            : null,
                      },
                    }
                  : {}),
                applied: res.applied,
                events: res.events,
              },
              0,
            );
          }
          if (typeof res.error === "string" && res.error) {
            // Pre-flight failure (unreadable dir / no tree) — nothing changed.
            return respond(
              { ok: false, error: res.error, code: "RT_E_VALIDATION", dir: res.dir },
              1,
            );
          }
          // Honest FAILED: persist the ledger (edited tree + failure trail),
          // then exit 1 with the first not-ok tail in the envelope.
          h.saveProject(path, res.project);
          return respond(
            {
              ok: false,
              outcome: res.outcome,
              error: `repair budget exhausted after ${res.cycles}/${res.budget} cycle(s) over ${res.dir} — ${res.treeTail ?? "tree-run not ok"}`,
              code: "RT_E_REPAIR_FAILED",
              path,
              dir: res.dir,
              cycles: res.cycles,
              budget: res.budget,
              treeTail: res.treeTail,
              treeRun: res.treeRun,
              import: importSummary,
              applied: res.applied,
              events: res.events,
            },
            1,
          );
        } catch (err) {
          respond(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
              ...errCode(err, "RT_E_INTERNAL"),
            },
            4,
          );
        }
        return;
      }

      case "edit": {
        // 216s (108-T1 · W7-L3 redo): the in-place edit verb — ONE textual
        // str_replace against a file of an emitted tree dir. DRY-RUN BY
        // DEFAULT: the would-be diff is returned and nothing is written; only
        // an explicit --write applies. The write path does not bypass the
        // governance seams — it consults the ONE policy seam (evaluatePolicy,
        // src/lib/policy.ts) for `repair.apply` on `tree:<dir>` and refuses
        // with a coded envelope when the seam denies the seat; it applies
        // through the T-107.1 applyStrReplace primitive (unique-match
        // contract: ambiguous / missing / no-op edits are coded refusals,
        // never guesses); and every applied write lands ONE attributed ledger
        // row on the --project file (actor + seat + decidedVia provenance +
        // patch + before/after hashes) — 108 §"mechanisms missing" #1: an
        // edit that is not attributed would claim provenance the audit trail
        // does not have. Existing verb exit codes are untouched:
        // dry-run/applied 0, refusal 1, internal 4.
        const dirArg = requireArg(args, "dir", "edit");
        if (dirArg.error !== undefined) return respond({ ok: false, error: dirArg.error, code: "RT_E_VALIDATION" }, 1);
        const dirPath = resolve(dirArg.value);
        if (!existsSync(dirPath)) {
          return respond(
            {
              ok: false,
              error: `edit: --dir ${JSON.stringify(dirArg.value)} does not exist — nothing to edit.`,
              code: "RT_E_VALIDATION",
              dir: dirPath,
            },
            1,
          );
        }
        const fileArg = requireArg(args, "file", "edit");
        if (fileArg.error !== undefined) return respond({ ok: false, error: fileArg.error, code: "RT_E_VALIDATION" }, 1);
        // Containment: the target must resolve INSIDE --dir (relative path, no
        // drive/absolute prefix, no `..` segment) — an edit verb must never
        // write outside the tree it names, whatever the caller passes.
        const relFile = fileArg.value.replace(/\\/g, "/").trim();
        const relSafe =
          relFile !== "" &&
          !relFile.startsWith("/") &&
          !/^[A-Za-z]:/.test(relFile) &&
          !relFile.split("/").some((seg) => seg === "..") &&
          (resolve(dirPath, relFile) + sep).startsWith(dirPath + sep);
        if (!relSafe) {
          return respond(
            {
              ok: false,
              error: `edit: --file ${JSON.stringify(fileArg.value)} must be a relative path inside --dir (no absolute path, no '..' segment).`,
              code: "RT_E_VALIDATION",
              dir: dirPath,
            },
            1,
          );
        }
        const targetPath = resolve(dirPath, relFile);
        // R11-f07 (S-05): the lexical checks above cannot see a symlinked
        // parent — verify the PHYSICAL containment too (shared helper).
        // confirmed-outside → refusal; `null` (unverifiable) keeps the
        // lexical verdict.
        if (physicalInside(dirPath, targetPath) === false) {
          return respond(
            {
              ok: false,
              error: `edit: --file ${JSON.stringify(fileArg.value)} resolves OUTSIDE --dir ${JSON.stringify(dirPath)} on the real filesystem (symlinked parent/junction) — refusing (R11-f07).`,
              code: "RT_E_VALIDATION",
              dir: dirPath,
            },
            1,
          );
        }
        const findArg = requireArg(args, "find", "edit");
        if (findArg.error !== undefined) {
          return respond(
            {
              ok: false,
              error: `${findArg.error} (the str_replace needle; the edit refuses an empty --find) — a needle beginning with -- needs the --find=<value> form (parseArgs reads a -- token as the next flag)`,
              code: "RT_E_VALIDATION",
            },
            1,
          );
        }
        // --replace may be EMPTY (a legal deletion: --replace="" or --replace
        // ""); a missing flag is refused, an empty value is honored.
        if (typeof args.replace !== "string") {
          return respond(
            {
              ok: false,
              error: 'edit: missing required --replace (pass the replacement text — a value beginning with -- needs the --replace=<value> form; --replace="" deletes the matched block)',
              code: "RT_E_VALIDATION",
            },
            1,
          );
        }
        let source;
        try {
          source = readFileSync(targetPath, "utf8");
        } catch (err) {
          return respond(
            {
              ok: false,
              error: `edit: cannot read ${JSON.stringify(targetPath)} — ${err instanceof Error ? err.message : String(err)}`,
              code: "RT_E_VALIDATION",
              dir: dirPath,
              file: relFile,
            },
            1,
          );
        }
        const wantWrite = flag(args, "write");
        // Policy seam FIRST — dry-run consults it too, so the pre-flight answer
        // (would --write be allowed?) is exactly what the write then enforces
        // (one rule, no divergence). The env read stays HERE: policy.ts is a
        // pure leaf and never reads env (its purity test pins that).
        //
        // R5-f12 (W29 LANE H · R11-f04/C2-f02): the --i-am-human claim is the
        // TWO-CHANNEL seat (see humanSeatClaim) — typed TTY re-entry presented,
        // env read expected; a non-TTY claim is refused before this seam (no
        // second channel exists there). The same-env-var-both-sides
        // degeneracy is statically forbidden by
        // scripts/cli-exit-taxonomy.test.mjs.
        const { evaluatePolicy, seatLabel } = await import("../src/lib/policy.ts");
        const humanSeat = flag(args, "i-am-human") ? await humanSeatClaim("edit") : null;
        if (humanSeat && humanSeat.error !== undefined) {
          return respond(
            {
              ok: false,
              action: "edit",
              mode: wantWrite ? "write" : "dry-run",
              written: false,
              error: humanSeat.error,
              code: "RT_E_VALIDATION",
              dir: dirPath,
              file: relFile,
            },
            1,
          );
        }
        const actor = humanSeat ? humanSeat.actor : { decidedBy: "autopilot", seat: "harness" };
        const resource = `tree:${dirPath}`;
        const verdict = evaluatePolicy("repair.apply", resource, {
          actor,
          humanSeatToken: humanSeat ? humanSeat.humanSeatToken : undefined,
          expectedHumanSeatToken: humanSeat ? humanSeat.expectedHumanSeatToken : undefined,
        });
        if (verdict.decision !== "allow") {
          return respond(
            {
              ok: false,
              action: "edit",
              mode: wantWrite ? "write" : "dry-run",
              written: false,
              error: `edit: refused by the policy seam — ${verdict.reason} (sanctioned fallback: ${verdict.fallback})`,
              code: "RT_E_VALIDATION",
              dir: dirPath,
              file: relFile,
              policy: { action: "repair.apply", resource, decision: "deny", reason: verdict.reason, fallback: verdict.fallback },
            },
            1,
          );
        }
        const { applyStrReplace } = await import("../src/lib/patch.ts");
        const patchResult = applyStrReplace(source, { oldStr: findArg.value, newStr: args.replace });
        if (patchResult.ok !== true) {
          // Coded refusal from the primitive (0 matches / ambiguous / no-op /
          // garbage input); nothing was written.
          return respond(
            {
              ok: false,
              action: "edit",
              mode: wantWrite ? "write" : "dry-run",
              written: false,
              error: `edit: ${patchResult.error}`,
              code: "RT_E_VALIDATION",
              dir: dirPath,
              file: relFile,
              patch: {
                kind: patchResult.kind,
                matches: patchResult.matches,
                lines: patchResult.lines,
                bestScore: patchResult.bestScore,
                bestLine: patchResult.bestLine,
              },
            },
            1,
          );
        }
        const { fnv1a } = await import("../src/lib/algorithms.ts");
        const hashBefore = String(fnv1a(source));
        const hashAfter = String(fnv1a(patchResult.text));
        const decidedVia = {
          action: "repair.apply",
          resource,
          reason: verdict.reason,
          label: seatLabel(actor),
          tokenPath: verdict.reason.split(" — ")[0] === "human-seat-token-verified",
        };
        const policyEcho = {
          action: "repair.apply",
          resource,
          decision: "allow",
          reason: verdict.reason,
          label: decidedVia.label,
          tokenPath: decidedVia.tokenPath,
        };
        if (!wantWrite) {
          // DRY-RUN (the default): the honest pre-flight — the diff, the
          // would-be hashes and the seat/policy verdict — and NOTHING written.
          return respond(
            {
              ok: true,
              action: "edit",
              mode: "dry-run",
              written: false,
              dir: dirPath,
              file: relFile,
              path: targetPath,
              kind: patchResult.kind,
              score: patchResult.score,
              matches: patchResult.matches,
              diff: patchResult.diff,
              hashBefore,
              hashAfter,
              policy: policyEcho,
              ledger: null,
              note: "dry-run (the default) — nothing was written; re-run with --write --project <file.json> to apply and attribute the edit in the ledger",
            },
            0,
          );
        }
        // --write: attribution is a PRECONDITION, not an afterthought — the
        // applied edit needs the ledger it lands in (108-T1: actor + patch +
        // resulting hash).
        const projArg = requireArg(args, "project", "edit --write");
        if (projArg.error !== undefined) {
          return respond(
            {
              ok: false,
              error: `${projArg.error} — an applied edit must be attributed in the ledger (actor + patch + resulting hash); dry-run (the default) needs no --project.`,
              code: "RT_E_VALIDATION",
              written: false,
              dir: dirPath,
              file: relFile,
            },
            1,
          );
        }
        const project = loadProjectFor("edit --write");
        const projectPath = requireProjectPath(args, "edit --write");
        // Atomic write-then-rename (the repo's write discipline): a crash can
        // never leave a truncated artifact behind.
        try {
          const tmp = `${targetPath}.edit-${process.pid}-${Date.now()}.tmp`;
          writeFileSync(tmp, patchResult.text, "utf8");
          renameSync(tmp, targetPath);
        } catch (err) {
          return respond(
            {
              ok: false,
              error: `edit: write failed — ${err instanceof Error ? err.message : String(err)}`,
              ...errCode(err, "RT_E_INTERNAL"),
              written: false,
              dir: dirPath,
              file: relFile,
            },
            4,
          );
        }
        // Ledger attribution — ONE append-only JsonLog row on the project the
        // dir belongs to (capped at 200 rows, the lessonLog convention):
        // event `edit.apply`, JSON detail carrying the actor seat, the
        // decidedVia provenance envelope (the same W6 shape the approve path
        // stamps) and the patch + before/after hashes.
        const logs = Array.isArray(project.logs) ? project.logs : [];
        const row = {
          ts: Date.now(),
          phase: project.currentPhase,
          level: "info",
          event: "edit.apply",
          detail: JSON.stringify({
            file: relFile,
            kind: patchResult.kind,
            score: patchResult.score,
            matches: patchResult.matches,
            startLine: patchResult.diff.startLine,
            endLine: patchResult.diff.endLine,
            removedLines: patchResult.diff.removedLines,
            addedLines: patchResult.diff.addedLines,
            hashBefore,
            hashAfter,
            actor: { decidedBy: actor.decidedBy, seat: actor.seat },
            decidedVia,
          }),
        };
        const nextProject = { ...project, logs: [...logs, row].slice(-200) };
        try {
          h.saveProject(projectPath, nextProject);
        } catch (err) {
          return respond(
            {
              ok: false,
              error: `edit: the file was written but the ledger row could not be persisted — ${err instanceof Error ? err.message : String(err)}`,
              ...errCode(err, "RT_E_INTERNAL"),
              written: true,
              ledgerSaved: false,
              dir: dirPath,
              file: relFile,
              path: targetPath,
            },
            4,
          );
        }
        return respond(
          {
            ok: true,
            action: "edit",
            mode: "write",
            written: true,
            dir: dirPath,
            file: relFile,
            path: targetPath,
            kind: patchResult.kind,
            score: patchResult.score,
            matches: patchResult.matches,
            diff: patchResult.diff,
            hashBefore,
            hashAfter,
            policy: policyEcho,
            ledger: {
              path: projectPath,
              event: "edit.apply",
              rows: Math.min(logs.length + 1, 200),
              decidedVia,
            },
            note: "the dir is the artifact; the ledger now carries the attributed edit row — run `tree-run --dir <dir> --project <file.json>` (or `repair` with the same flags) to re-check the edited tree",
          },
          0,
        );
      }

      case "summary": {
        const project = loadProjectFor("summary");
        respond({ ok: true, summary: h.summary(project) }, 0);
        return;
      }

      case "vault": {
        const project = loadProjectFor("vault");
        try {
          // fixes/144 (M1): default = <home>/RapidTool Software/<slug>/vault —
          // same parent as the emitted software, per-project (--out overrides).
          if (pathFlagMissing(args.out)) {
            return respond(
              { ok: false, error: pathFlagRefusalError("vault", "out", args.out), code: "RT_E_VALIDATION" },
              1,
            );
          }
          const dest = typeof args.out === "string" ? { path: args.out, fallback: false, error: null } : defaultOutputDir(h, project, "vault");
          const res = await h.writeVault(project, resolve(dest.path));
          const envelope = { ok: true, count: res.count, dir: res.dir };
          if (dest.fallback) {
            envelope.fallback = true;
            envelope.warning = `Home vault dir was unwritable (${dest.error ?? "unknown"}) — wrote under CWD instead: ${res.dir}`;
          }
          respond(envelope, 0);
        } catch (err) {
          // R5-f03 (W29 · A2-f03): internal runtime failure → exit 4 per the
          // documented taxonomy (README-cli.md: "Exit 4 = backend or internal
          // runtime failure"). The usage-class failures (unreadable project,
          // bad args) exit 1 with their own codes BEFORE this catch.
          respond(
            { ok: false, error: err instanceof Error ? err.message : String(err), ...errCode(err, "RT_E_INTERNAL") },
            4,
          );
        }
        return;
      }

      case "search": {
        const project = loadProjectFor("search");
        const query = requireArg(args, "query", "search");
        if (query.error !== undefined) return respond({ ok: false, error: query.error, code: "RT_E_VALIDATION" }, 1);
        try {
          const limit =
            typeof args.limit === "string" && /^\d+$/.test(args.limit) ? parseInt(args.limit, 10) : 10;
          const results = await h.vaultSearch(project, query.value, limit);
          respond({ ok: true, query: query.value, count: results.length, results }, 0);
        } catch (err) {
          respond(
            { ok: false, error: err instanceof Error ? err.message : String(err), ...errCode(err, "RT_E_INTERNAL") },
            4,
          );
        }
        return;
      }

      case "crew": {
        const project = loadProjectFor("crew");
        const opts = {};
        // 316 H7 (carried by I4): parseArgs stores the raw `--max-steps` key —
        // reading `args.maxSteps` silently ignored the ONE documented crew knob
        // (the flag parsed fine, then no-oped). Read the key the parser writes.
        if (typeof args["max-steps"] === "string" && /^\d+$/.test(args["max-steps"])) {
          opts.maxSteps = parseInt(args["max-steps"], 10);
        }
        // W45·331-1: meter the run's REAL provider spend through the provider
        // call tap (setLlmCallTap — the provider funnel every registry call
        // routes through). The envelope reports measured usage, never an
        // estimate; cleared in `finally` so no later verb sees the tap.
        const { setLlmCallTap } = await import(DEEPSEEK_SERVER_PATH);
        const crewUsage = { calls: 0, promptTokens: 0, completionTokens: 0 };
        setLlmCallTap((rec) => {
          crewUsage.calls += 1;
          crewUsage.promptTokens += typeof rec.promptTokens === "number" ? rec.promptTokens : 0;
          crewUsage.completionTokens +=
            typeof rec.completionTokens === "number" ? rec.completionTokens : 0;
        });
        let res;
        try {
          res = await h.runCrew(project, opts);
        } finally {
          setLlmCallTap(null);
        }
        if (res.ok === false) {
          const hint =
            res.reason === "not-configured"
              ? " — set DEEPSEEK_API_KEY (repo .env or process environment) to enable the crew"
              : "";
          const error =
            typeof res.error === "string" && res.error
              ? `${res.error}${hint}`
              : `crew unavailable (${res.reason ?? "error"})${hint}`;
          // E-25: backend not configured → 3; runtime/backend failure → 4.
          // W45·331-1: carry the provider's own code (e.g. RT_E_LLM_KEY_REJECTED)
          // instead of re-classifying the prose down to RT_E_UNKNOWN.
          return respond(
            {
              ok: false,
              reason: res.reason,
              error,
              ...(typeof res.code === "string" && res.code ? { code: res.code } : {}),
            },
            res.reason === "not-configured" ? 3 : 4,
          );
        }
        respond(
          {
            ok: true,
            messages: res.messages,
            artifacts: res.artifacts,
            stopped: res.stopped,
            ...(crewUsage.calls > 0 ? { usage: crewUsage } : {}),
          },
          0,
        );
        return;
      }

      case "verify": {
        const project = loadProjectFor("verify");
        let outcome;
        try {
          outcome = await h.verifyGeneratedSource(project);
        } catch (err) {
          // No generatedSource yet = validation/state error (exit 1, README
          // contract); anything else is internal (outer handler → 4).
          if (err instanceof Error && /no generatedSource/.test(err.message)) {
            return respond({ ok: false, error: err.message, code: "RT_E_PHASE_ILLEGAL" }, 1);
          }
          throw err;
        }
        // E-06: --apply persists the outcome into the project file. A passed
        // verdict stamps lastTest (label "tested" + evidenceHash) + a "verify"
        // artifact; failed/error append a verify.fail artifact. not-configured
        // changes NOTHING (never a partial write).
        let applied = false;
        if (flag(args, "apply") && outcome.status !== "not-configured") {
          const updated = h.applyVerifyOutcome(project, outcome);
          h.saveProject(requireProjectPath(args, "verify"), updated);
          applied = true;
        }
        const payload = { ok: outcome.status === "passed", ...outcome, applied };
        // Failed verdicts carry no `error` key today (VerifyOutcomeShape has
        // none) — the prose classifier would read "" and stamp RT_E_UNKNOWN on
        // every failure. Surface the evidence so timeouts/refusals classify.
        if (!payload.ok && typeof payload.error === "undefined") {
          payload.error =
            typeof outcome.evidence === "string" && outcome.evidence
              ? outcome.evidence
              : `verify ${outcome.status}`;
        }
        // E-25: passed → 0; failed verdict → 1; not configured → 3; backend
        // runtime failure → 4.
        const exitCode =
          outcome.status === "passed"
            ? 0
            : outcome.status === "failed"
              ? 1
              : outcome.status === "not-configured"
                ? 3
                : 4;
        if (exitCode === 4) {
          const hint =
            outcome.status === "error" && typeof outcome.evidence === "string" && outcome.evidence
              ? outcome.evidence
              : "verify backend error";
          console.error(hint);
        }
        return respond(payload, exitCode);
      }

      case "check": {
        // fixes/132 (C2): per-file compile verdicts over an EMITTED dir
        // (compile-check.server.ts). All pass → 0; any fail → 1 (verdicts
        // carried on stdout); missing dir / internal error → 4.
        const dirArg = requireArg(args, "dir", "check");
        if (dirArg.error !== undefined) return respond({ ok: false, error: dirArg.error, code: "RT_E_VALIDATION" }, 1);
        try {
          const cc = await checkDriver();
          const result = cc.compileCheckDir(resolve(dirArg.value));
          if (result.ok) {
            return respond({ ok: true, ...result }, 0);
          }
          const reason =
            typeof result.error === "string" && result.error
              ? result.error
              : `${result.failed} of ${result.checked} files failed compile-check`;
          // fixes/135: an expected any-fail verdict is NOT an unknown error —
          // carry the honest per-file verdicts with a check-specific code.
          return respond({ ok: false, error: reason, code: "RT_E_CHECK_FAILED", ...result }, 1);
        } catch (err) {
          return respond(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
              ...errCode(err, "RT_E_INTERNAL"),
            },
            4,
          );
        }
      }

      case "scan": {
        // W23 L6 (G4 · 249 SPEC 3, OV-21 fold): an ADVISORY error-signal scan
        // over an EMITTED (or any) dir — read-only, no project needed, no
        // policy seam, no writes (structure mirrors the `tree-run` arm). The
        // rules are lexer-level heuristics: R1 catch-empty, R2 catch-swallowed,
        // R3 neutral-return-unimplemented (OV-21's fold). Findings → exit 1;
        // a clean tree → 0; an unreadable dir → 1 + RT_E_VALIDATION. This verb
        // is NEVER wired into a gate and never blocks an emit (218 §3.4/OV-21).
        const scanDir = requireArg(args, "dir", "scan");
        if (scanDir.error !== undefined) return respond({ ok: false, error: scanDir.error, code: "RT_E_VALIDATION" }, 1);
        try {
          const { scanTreeErrorSignals } = await import("../src/lib/error-scan.server.ts");
          const scan = scanTreeErrorSignals(resolve(scanDir.value));
          if (scan.ok !== true) {
            return respond({ ok: false, dir: scan.dir, error: scan.error, code: scan.code }, 1);
          }
          const findings = scan.findings;
          const payload = {
            ok: findings.length === 0,
            dir: scan.dir,
            scanned: scan.scanned,
            findings,
            advisory: true,
            note: "advisory finding surface — never blocks an emit (218 §3.4 / OV-21)",
          };
          if (findings.length > 0) {
            // 330 Switchboard (probed): the sibling check-verbs carry an
            // `error` on a non-ok result (`check` → its reason, `tree-run` →
            // the first not-ok tail); `scan` shipped an EMPTY one, so every
            // findings envelope auto-classified as the opaque RT_E_UNKNOWN
            // with NO message — an agent branching on `code` read a designed
            // advisory outcome as an opaque failure. Name the outcome; the
            // findings array remains the payload.
            payload.error = `scan: ${findings.length} advisory finding(s) in ${scan.dir} — heuristics, not verdicts; review findings[].rule (advisory, never blocks an emit)`;
          }
          return respond(payload, payload.ok ? 0 : 1);
        } catch (err) {
          return respond(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
              ...errCode(err, "RT_E_INTERNAL"),
            },
            4,
          );
        }
      }

      case "design": {
        const project = loadProjectFor("design");
        try {
          // R5-f10 (W29 · A2-f11): valueless --html guard (see packet).
          if (pathFlagMissing(args.html)) {
            return respond(
              { ok: false, error: pathFlagRefusalError("design", "html", args.html), code: "RT_E_VALIDATION" },
              1,
            );
          }
          const tokens = await h.designTokens(project);
          const result = { ok: true, tokens };
          if (typeof args.html === "string") {
            const html = await h.designHtml(project);
            const out = resolve(args.html);
            mkdirSync(dirname(out), { recursive: true });
            writeFileSync(out, html, "utf8");
            result.htmlWritten = out;
          }
          respond(result, 0);
        } catch (err) {
          respond(
            { ok: false, error: err instanceof Error ? err.message : String(err), ...errCode(err, "RT_E_INTERNAL") },
            4,
          );
        }
        return;
      }

      case "diagram": {
        const project = loadProjectFor("diagram");
        const kind = requireArg(args, "kind", "diagram");
        if (kind.error !== undefined) return respond({ ok: false, error: kind.error, code: "RT_E_VALIDATION" }, 1);
        // Validate the kind at the CLI seam (headless throws the same guard,
        // but the CLI owns the exit-1 VALIDATION envelope for usage errors).
        if (!h.DIAGRAM_KINDS.includes(kind.value)) {
          return respond(
            {
              ok: false,
              error: `diagram: unknown --kind "${kind.value}" — expected one of ${h.DIAGRAM_KINDS.join(" | ")}.`,
              code: "RT_E_VALIDATION",
            },
            1,
          );
        }
        try {
          const svg = await h.buildDiagram(project, kind.value); // throws on unknown kind / missing module
          const result = { ok: true, kind: kind.value, bytes: Buffer.byteLength(svg, "utf8") };
          // R5-f10 (W29 · A2-f11): valueless --out guard (see packet).
          if (pathFlagMissing(args.out)) {
            return respond(
              { ok: false, error: pathFlagRefusalError("diagram", "out", args.out), code: "RT_E_VALIDATION" },
              1,
            );
          }
          if (typeof args.out === "string") {
            const out = resolve(args.out);
            mkdirSync(dirname(out), { recursive: true });
            writeFileSync(out, svg, "utf8");
            result.svgWritten = out;
          }
          respond(result, 0);
        } catch (err) {
          respond(
            { ok: false, error: err instanceof Error ? err.message : String(err), ...errCode(err, "RT_E_INTERNAL") },
            4,
          );
        }
        return;
      }

      case "artifacts": {
        const project = loadProjectFor("artifacts");
        const items = h.listArtifacts(project);
        respond({ ok: true, count: items.length, items }, 0);
        return;
      }

      // -------------------------------------------------------------------
      // New-pillar subcommands (additive): harvest / swarm / prompt / bench /
      // mine / knowledge / wild. Each keeps the one-JSON envelope + exit-code
      // discipline; backend not-configured → 3, usage/state errors → 1,
      // unexpected module failure → outer handler (4).
      // -------------------------------------------------------------------

      case "harvest": {
        // Bounded live-source harvest for the project brief. The module never
        // fabricates: unreachable backends yield rows [] + honest notes (exit
        // 0 — the honest empty payload IS the outcome).
        const project = loadProjectFor("harvest");
        try {
          const res = await h.harvest(project);
          if (res.ok === false) {
            return respond({ ok: false, reason: res.reason, error: res.error, code: res.code }, 1);
          }
          respond(
            {
              ok: true,
              count: res.rows.length,
              rows: res.rows,
              queries: res.queries,
              querySource: res.querySource,
              notes: res.notes,
            },
            0,
          );
        } catch (err) {
          respond(
            { ok: false, error: err instanceof Error ? err.message : String(err), ...errCode(err, "RT_E_INTERNAL") },
            4,
          );
        }
        return;
      }

      case "swarm": {
        // Deterministic advisory swarm critique (pure state analysis, no LLM).
        const project = loadProjectFor("swarm");
        try {
          const res = await h.swarmPlan(project);
          respond(
            {
              ok: true,
              advisory: true,
              phase: res.phase,
              critiques: res.critiques,
              refinedPlan: res.refinedPlan,
              artifacts: res.artifacts,
            },
            0,
          );
        } catch (err) {
          respond(
            { ok: false, error: err instanceof Error ? err.message : String(err), ...errCode(err, "RT_E_INTERNAL") },
            4,
          );
        }
        return;
      }

      case "prompt": {
        // Hyper-prompt expansion (deepseek-v4-flash json) — crew-style exits:
        // not-configured → 3 (RT_E_LLM_NOT_CONFIGURED), backend failure → 4.
        const project = loadProjectFor("prompt");
        const policies =
          typeof args.policies === "string" && args.policies.trim()
            ? args.policies.split(",").map((s) => s.trim()).filter(Boolean)
            : undefined;
        const res = await h.promptExpand(project, policies);
        if (res.ok === false) {
          const hint =
            res.reason === "not-configured"
              ? " — set DEEPSEEK_API_KEY (repo .env or process environment) to enable prompt expansion"
              : "";
          const error =
            typeof res.error === "string" && res.error
              ? `${res.error}${hint}`
              : `prompt expansion unavailable (${res.reason ?? "error"})${hint}`;
          // W45·331-1: carry the provider's code (same reason as the crew arm).
          return respond(
            {
              ok: false,
              reason: res.reason,
              error,
              ...(typeof res.code === "string" && res.code ? { code: res.code } : {}),
            },
            res.reason === "not-configured" ? 3 : 4,
          );
        }
        respond({ ok: true, spec: res.spec }, 0);
        return;
      }

      case "bench": {
        // Synthetic estimate suite (tokens/time/complexity/failure points) —
        // heuristic, never presented as a measured run (disclaimer included).
        const project = loadProjectFor("bench");
        try {
          const res = await h.benchProject(project);
          respond(
            {
              ok: true,
              disclaimer: res.disclaimer,
              token: res.token,
              time: res.time,
              complexity: res.complexity,
              failurePoints: res.failurePoints,
            },
            0,
          );
        } catch (err) {
          respond(
            { ok: false, error: err instanceof Error ? err.message : String(err), ...errCode(err, "RT_E_INTERNAL") },
            4,
          );
        }
        return;
      }

      case "mine": {
        // Bounded structural codebase map of a real directory (no project
        // needed). Every skip (non-source, too large, over limit) is reported.
        const dir = requireArg(args, "dir", "mine");
        if (dir.error !== undefined) return respond({ ok: false, error: dir.error, code: "RT_E_VALIDATION" }, 1);
        const opts = {};
        if (typeof args.limit === "string" && /^\d+$/.test(args.limit)) {
          opts.maxFiles = parseInt(args.limit, 10);
        }
        try {
          const res = await h.mineDir(resolve(dir.value), opts);
          respond(
            {
              ok: true,
              dir: res.dir,
              fileCount: res.files.length,
              files: res.files,
              map: res.map,
              conventions: res.conventions,
              skipped: res.skipped,
            },
            0,
          );
        } catch (err) {
          respond(
            { ok: false, error: `mine: ${err instanceof Error ? err.message : String(err)}`, code: "RT_E_VALIDATION" },
            1,
          );
        }
        return;
      }

      case "knowledge": {
        // Cross-project JSON pattern store: --save <json> appends one entry
        // (idempotent, content-fingerprinted); --find <query> searches. Exactly
        // one of the two is required.
        const store = requireArg(args, "store", "knowledge");
        if (store.error !== undefined) return respond({ ok: false, error: store.error, code: "RT_E_VALIDATION" }, 1);
        const save = typeof args.save === "string" ? args.save : undefined;
        const find = typeof args.find === "string" ? args.find : undefined;
        if (save !== undefined && find !== undefined) {
          return respond(
            { ok: false, error: "knowledge: pass exactly one of --save <json> or --find <query>", code: "RT_E_VALIDATION" },
            1,
          );
        }
        if (save === undefined && find === undefined) {
          return respond(
            { ok: false, error: "knowledge: requires --save <json> or --find <query>", code: "RT_E_VALIDATION" },
            1,
          );
        }
        try {
          if (save !== undefined) {
            let pattern;
            try {
              pattern = JSON.parse(save);
            } catch (err) {
              return respond(
                { ok: false, error: `knowledge: --save is not valid JSON: ${err.message}`, code: "RT_E_VALIDATION" },
                1,
              );
            }
            if (
              !pattern ||
              typeof pattern !== "object" ||
              typeof pattern.title !== "string" ||
              !pattern.title.trim() ||
              !Array.isArray(pattern.tags)
            ) {
              return respond(
                {
                  ok: false,
                  error: "knowledge: --save JSON must be {project, kind, title, tags: string[], body}",
                  code: "RT_E_VALIDATION",
                },
                1,
              );
            }
            const res = await h.knowledgeSave(resolve(store.value), pattern);
            respond({ ok: true, entry: res.entry, appended: res.appended }, 0);
          } else if (find !== undefined) {
            const limit =
              typeof args.limit === "string" && /^\d+$/.test(args.limit) ? parseInt(args.limit, 10) : 5;
            const matches = await h.knowledgeFind(resolve(store.value), find, limit);
            respond({ ok: true, count: matches.length, matches }, 0);
          }
        } catch (err) {
          respond(
            { ok: false, error: err instanceof Error ? err.message : String(err), ...errCode(err, "RT_E_INTERNAL") },
            4,
          );
        }
        return;
      }

      case "lesson": {
        // fixes/144 M5-4 (98 §7): the LESSON verb family — one verb, exactly
        // one action flag (the `wild` pattern). Read-only on project memory:
        //   --list      project's lesson-tagged memory rows (never writes)
        //   --propose   a bounded flash DRAFT of a cross-project row from raw
        //               evidence (never writes — keyed: one bounded DeepSeek
        //               turn; keyless: deterministic keyword draft, labeled)
        // The human-gated cross-project WRITE (the only append to a store):
        //   --accept    top FusionRank lesson rows of --project → the store
        //               at --out, actor recorded in every row (idempotent)
        // Store telemetry writers (append-only rows / counters, never deletes):
        //   --supersede a newer row declares an old entry dead (append + mark)
        //   --refute    one counter-evidence unit against an entry (decay)
        // 216s (112 T5) — the read-only consult + proof-check arms:
        //   --advise    ranked FAIL-class lesson rows for a brief (pre-flight)
        //   --verify    anchor re-hash → ok | stale | anchor-missing
        //               (read-only unless --mark-stale: store telemetry only)
        // F3 (221 §F3 — W18 lane 2) — the measurement arm:
        //   --effect    cross-run learning census from project memory rows
        //               (reproduced/unreproduced, per-class rates, evidence
        //               with the accruing ledger rows) — read-only
        const actions = ["list", "propose", "accept", "supersede", "refute", "advise", "verify", "effect"].filter(
          (a) => flag(args, a),
        );
        if (actions.length !== 1) {
          return respond(
            {
              ok: false,
              error: `lesson: pass exactly one of --list|--propose|--accept|--supersede|--refute|--advise|--verify|--effect (got ${actions.length})`,
              code: "RT_E_VALIDATION",
            },
            1,
          );
        }
        const action = actions[0];
        const k = await knowledgeDriver();
        try {
          if (action === "list") {
            // Read-only (never writes): the project's lesson-tagged memory
            // rows with kind/class/phase/score/evidence detail. --brief <text>
            // ranks them against that brief via topLessonRows (fusionRank —
            // the same read-back semantics the tier-2 seams use, fixes/144
            // M5-4); without --brief the rows come score-desc / id-asc (the
            // selectLessons convention). --limit caps either; default: all
            // rows (score-desc) / top 10 (fusionRank).
            const project = loadProjectFor("lesson list");
            const allRows = (project.memory ?? []).filter(
              (m) => m && typeof m === "object" && Array.isArray(m.tags) && m.tags.includes("lesson"),
            );
            const briefText = typeof args.brief === "string" ? args.brief.trim() : "";
            const limit =
              typeof args.limit === "string" && /^\d+$/.test(args.limit) ? parseInt(args.limit, 10) : null;
            let ordered;
            if (briefText) {
              ordered = k.topLessonRows(project.memory ?? [], briefText, limit ?? 10);
            } else {
              ordered = [...allRows].sort((a, b) =>
                b.score - a.score !== 0 ? b.score - a.score : a.id < b.id ? -1 : 1,
              );
              if (limit !== null) ordered = ordered.slice(0, limit);
            }
            const rows = ordered.map((m) => {
              const tags = (m.tags ?? []).filter(
                (t) => typeof t === "string" && t.trim() !== "" && !t.startsWith("actor:"),
              );
              const level = tags.find((t) => /^L[1-5]$/.test(t)) ?? null;
              // ONE classifier with the F3 report (knowledge.lessonClassTag):
              // it also skips probe:/actor: telemetry tags — without that skip
              // a probe-tagged row reported its first PROBE tag as its class.
              const cls = k.lessonClassTag(tags);
              return {
                id: m.id,
                kind: m.kind,
                class: cls,
                level,
                phase: m.phase,
                score: m.score,
                evidence: m.text,
                source: m.source ?? null,
                url: m.url ?? null,
                tags,
              };
            });
            respond(
              {
                ok: true,
                action: "list",
                project: project.name,
                readOnly: true,
                rankedBy: briefText ? "fusion-rank" : "score-desc",
                count: rows.length,
                rows,
              },
              0,
            );
            return;
          }
          if (action === "effect") {
            // F3 (221 §F3 — W18 lane 2): cross-run learning MEASUREMENT — the
            // read-only 8th arm. The census of the project's lesson-tagged
            // memory rows plus their post-minting recurrence telemetry
            // (`reproducedCount`, accrued by engine.accrueReproducedCounts /
            // report-intake.ts's twin accrual / verify.ts's repro-accrual) and
            // the `lesson.reproduced` ledger rows that accrued it, read back
            // from the project's own logs. NO writer: no promotion, no
            // demotion, no mint — and the T-11 mute stays (a red seal mints no
            // lesson row, so it cannot count here). The recurrence≠causation
            // label, the census-window disclosure and the n≥2 "baseline only"
            // floor ride INSIDE the JSON object (knowledge.lessonOutcomeReport).
            if (typeof args["knowledge-file"] === "string" && args["knowledge-file"].trim()) {
              return respond(
                {
                  ok: false,
                  error:
                    "lesson effect: the reproduction census lives in project MEMORY rows — the cross-project store carries counterEvidence, not reproducedCount (and no ledger rows); refusing --knowledge-file rather than reporting an empty store as a measurement",
                  code: "RT_E_VALIDATION",
                },
                1,
              );
            }
            const project = loadProjectFor("lesson effect");
            const report = k.lessonOutcomeReport(project.memory ?? [], { logs: project.logs ?? [] });
            respond(
              {
                ok: true,
                action: "effect",
                project: project.name,
                readOnly: true,
                ...report,
              },
              0,
            );
            return;
          }
          if (action === "propose") {
            // Bounded flash DRAFT only — this arm never writes. Keyless (or a
            // failed/absent keyed turn) → the deterministic keyword draft via
            // knowledge.ts proposeLessonFallback, labeled mode:"keyless".
            const brief = requireArg(args, "brief", "lesson propose");
            if (brief.error !== undefined) return respond({ ok: false, error: brief.error, code: "RT_E_VALIDATION" }, 1);
            const kind =
              typeof args.kind === "string" && ["fix", "pattern", "note"].includes(args.kind)
                ? args.kind
                : "note";
            const tags =
              typeof args.tags === "string" && args.tags.trim()
                ? args.tags.split(",").map((s) => s.trim()).filter(Boolean)
                : [];
            const sourceProject =
              typeof args.project === "string" && args.project.trim() ? args.project.trim() : null;
            // Source-project NAME only (never a path) — the CLI documents that
            // this flag is the origin project's name for the draft's `project`
            // field, NOT a project file to load.
            const deterministic = () => {
              const entry = k.proposeLessonFallback({
                project: sourceProject ?? "(proposed)",
                kind,
                title:
                  typeof args.title === "string" && args.title.trim()
                    ? args.title.trim()
                    : brief.value.slice(0, 80),
                tags,
                body: brief.value,
              });
              return entry;
            };
            let mode = "keyless";
            let draft = deterministic();
            let note =
              "deterministic keyword draft (no DEEPSEEK_API_KEY, or the keyed seam was not used) — labeled, never fabricated; save with: knowledge --store <file.json> --save '<draft-json>'";
            // Keyed seam: ONE bounded flash turn to polish the draft (json
            // mode, small token cap). Any failure → the deterministic floor
            // above with the reason in `note` — never a half-draft.
            const { isDeepSeekConfigured, completeDeepSeek } = await import(
              pathToFileURL(
                join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "deepseek.server.ts"),
              ).href
            );
            if (typeof isDeepSeekConfigured === "function" && isDeepSeekConfigured()) {
              try {
                const res = await completeDeepSeek(
                  `Draft a cross-project RapidTool lesson entry from this raw evidence. ` +
                    `Return STRICT JSON only: {"title": string ≤ 80 chars, "body": string ≤ 1200 chars (one line), "tags": string[] ≤ 6 lowercase short tags}. ` +
                    `Evidence: ${brief.value.slice(0, 2000)}`,
                  { json: true, maxTokens: 400 },
                );
                if (res.ok === true) {
                  const parsed = JSON.parse(res.text);
                  if (
                    parsed &&
                    typeof parsed === "object" &&
                    typeof parsed.title === "string" &&
                    typeof parsed.body === "string" &&
                    Array.isArray(parsed.tags)
                  ) {
                    draft = k.proposeLessonFallback({
                      project: sourceProject ?? "(proposed)",
                      kind,
                      title: parsed.title,
                      tags: parsed.tags.filter((t) => typeof t === "string"),
                      body: parsed.body,
                    });
                    mode = "keyed";
                    note =
                      "keyed flash draft (bounded single DeepSeek turn, json mode) — review before saving with: knowledge --store <file.json> --save '<draft-json>'";
                  }
                }
              } catch {
                // fall through to the deterministic draft already in hand
              }
            }
            respond(
              {
                ok: true,
                action: "propose",
                mode,
                // Honest provenance label (mission: keyless drafts are always
                // labeled): the response carries the source so a caller can
                // never mistake the deterministic floor for a model draft.
                source: mode === "keyed" ? "keyed flash draft" : "draft (keyless)",
                draft,
                note,
              },
              0,
            );
            return;
          }
          if (action === "accept") {
            // THE human-gated cross-project write (98 §7): promoting this
            // project's top lesson rows into the shared store is an explicit
            // human act — there is no machine path that appends to the store.
            const project = loadProjectFor("lesson accept");
            const out = requireArg(args, "out", "lesson accept");
            if (out.error !== undefined) return respond({ ok: false, error: out.error, code: "RT_E_VALIDATION" }, 1);
            const limit =
              typeof args.limit === "string" && /^\d+$/.test(args.limit) ? parseInt(args.limit, 10) : 5;
            const actor =
              (typeof args.actor === "string" && args.actor.trim()
                ? args.actor.trim()
                : process.env.RAPIDTOOL_ACTOR || process.env.USERNAME || process.env.USER || "cli-human"
              ).slice(0, 60);
            const top = k.topLessonRows(project.memory ?? [], project.brief, limit);
            if (top.length === 0) {
              return respond(
                {
                  ok: false,
                  error: `lesson accept: project "${project.name}" has no lesson-tagged memory rows to promote (top ${limit} FusionRank rows, ranked against the brief)`,
                  code: "RT_E_VALIDATION",
                },
                1,
              );
            }
            const store = new k.KnowledgeStore(resolve(out.value));
            const promoted = top.map((row) => {
              const res = store.savePattern(k.acceptedLessonEntry({ project: project.name, actor, row }));
              return {
                entryId: res.entry.id,
                appended: res.appended,
                refused: res.refused === true,
                reason: res.reason ?? null,
                lessonRow: row.id,
                title: res.entry.title,
              };
            });
            const appendedCount = promoted.filter((r) => r.appended).length;
            const refusedCount = promoted.filter((r) => r.refused).length;
            respond(
              {
                ok: true,
                action: "accept",
                store: resolve(out.value),
                actor,
                // 209 honesty: promoted = newly appended rows, not attempt count
                promoted: appendedCount,
                attempted: promoted.length,
                refused: refusedCount,
                rows: promoted,
                note:
                  refusedCount > 0
                    ? `append-only store — ${appendedCount} appended, ${refusedCount} refused (eval-gate or duplicate). Human accept carries actor provenance; identical re-accept is appended:false.`
                    : "append-only store — the promoted rows carry actor + source-row provenance; re-accept of identical rows is an idempotent no-op (appended:false)",
              },
              0,
            );
            return;
          }
          if (action === "supersede") {
            // A newer row declares an old entry dead — an APPEND, never a
            // delete (append-only law). The old row stays on disk but is
            // excluded from read-back (findPatterns/injectProven).
            const file = requireArg(args, "knowledge-file", "lesson supersede");
            if (file.error !== undefined) return respond({ ok: false, error: file.error, code: "RT_E_VALIDATION" }, 1);
            const id = requireArg(args, "id", "lesson supersede");
            if (id.error !== undefined) return respond({ ok: false, error: id.error, code: "RT_E_VALIDATION" }, 1);
            // --evidence <text> is the human's rationale (the superseding
            // row's body carries it verbatim; the old row keeps its ledger).
            // --reason is accepted as an alias for older invocations. Optional:
            // an absent rationale records "(no reason recorded)" — a supersede
            // is an append, and the audit row must still land.
            const evidence = [args.evidence, args.reason].find(
              (v) => typeof v === "string" && v.trim() !== "",
            );
            const reasonText = typeof evidence === "string" ? evidence.trim() : "(no reason recorded)";
            const by = args.by === "machine" ? "machine" : "human";
            const store = new k.KnowledgeStore(resolve(file.value));
            if (!store.entries().some((e) => e.id === id.value)) {
              return respond(
                {
                  ok: false,
                  error: `lesson supersede: no entry with id ${id.value} in ${resolve(file.value)}`,
                  code: "RT_E_VALIDATION",
                },
                1,
              );
            }
            const entry = k.buildSupersedeEntry({
              oldId: id.value,
              reason: reasonText,
              project: typeof args.project === "string" && args.project.trim() ? args.project.trim() : "cli",
              by,
            });
            const saved = store.savePattern(entry);
            const updated = store.markSuperseded(id.value, saved.entry.id);
            respond(
              {
                ok: true,
                action: "supersede",
                store: resolve(file.value),
                supersedingId: saved.entry.id,
                appended: saved.appended,
                superseded: updated ? { id: updated.id, supersededBy: updated.supersededBy ?? [] } : null,
                evidence: reasonText === "(no reason recorded)" ? null : reasonText,
                by,
                note: "supersede is an append — the old row remains on disk (audit) but is filtered from read-back",
              },
              0,
            );
            return;
          }
          if (action === "advise") {
            // 216s (112 T5 · §4.4 consult-before-failing): read-only ranked
            // pre-flight. The fail-class lesson rows of ONE source — the
            // --project's memory or a --knowledge-file store — are ranked
            // against --brief (fusionRank; a blank/absent project brief
            // degrades to score-desc) and optionally phase-filtered
            // (--phase N, project rows only — store rows carry no phase).
            // The live telemetry the rows actually carry is printed as-is.
            // HONEST LIMIT (declare-or-strike): dossier 112 §3.1's
            // verdict/scope/stale fields are NOT part of the row schema on
            // disk — nothing here fabricates them; the note names the live
            // signals (reproducedCount / counterEvidence) instead.
            const ADVISE_FAIL_CLASSES = ["vague-brief", "template-emission", "verify-failure", "drift", "run-summary"];
            const ADVISE_FAIL_RE = /(vague-brief|template-emission|verify-failure|drift|run-summary|harvest-[a-z-]+)/i;
            const failClassOf = (tags, text) => {
              const list = Array.isArray(tags) ? tags.filter((t) => typeof t === "string") : [];
              const byTag = list.find((t) => ADVISE_FAIL_CLASSES.includes(t) || t.startsWith("harvest-"));
              if (byTag) return byTag;
              const m = typeof text === "string" ? text.match(ADVISE_FAIL_RE) : null;
              return m ? m[1].toLowerCase() : null;
            };
            const hasProject = typeof args.project === "string" && args.project.trim() !== "";
            const storeFile = typeof args["knowledge-file"] === "string" ? args["knowledge-file"] : "";
            const hasStore = storeFile.trim() !== "";
            if (hasProject === hasStore) {
              return respond(
                {
                  ok: false,
                  error:
                    "lesson advise: pass exactly one source — --project <file.json> (project-local lessons) or --knowledge-file <store.json> (cross-project lessons)",
                  code: "RT_E_VALIDATION",
                },
                1,
              );
            }
            const limit =
              typeof args.limit === "string" && /^\d+$/.test(args.limit) ? parseInt(args.limit, 10) : 5;
            if (!Number.isInteger(limit) || limit < 1) {
              return respond(
                {
                  ok: false,
                  error: `lesson advise: --limit must be a positive integer (got ${String(args.limit)})`,
                  code: "RT_E_VALIDATION",
                },
                1,
              );
            }
            const phaseFilter =
              typeof args.phase === "string" && /^\d+$/.test(args.phase) ? parseInt(args.phase, 10) : null;
            if (args.phase !== undefined && (phaseFilter === null || phaseFilter > 12)) {
              return respond(
                {
                  ok: false,
                  error: `lesson advise: --phase must be an integer 0..12 (got ${String(args.phase)})`,
                  code: "RT_E_VALIDATION",
                },
                1,
              );
            }
            const briefText = typeof args.brief === "string" ? args.brief.trim() : "";
            const adviseRow = (m) => ({
              id: m.id,
              class: failClassOf(m.tags, m.text),
              level: (Array.isArray(m.tags) ? m.tags : []).find((t) => /^L[1-5]$/.test(t)) ?? null,
              phase: m.phase,
              score: m.score,
              reproducedCount: Number.isFinite(m.reproducedCount) ? m.reproducedCount : 0,
              counterEvidence: Number.isFinite(m.counterEvidence) ? m.counterEvidence : 0,
              source: m.source ?? null,
              evidence: m.text,
            });
            if (hasProject) {
              const project = loadProjectFor("lesson advise");
              const lessonRows = (project.memory ?? []).filter(
                (m) => m && typeof m === "object" && Array.isArray(m.tags) && m.tags.includes("lesson"),
              );
              const failRows = lessonRows.filter(
                (m) =>
                  failClassOf(m.tags, m.text) !== null && (phaseFilter === null || m.phase === phaseFilter),
              );
              const rows = k.topLessonRows(failRows, briefText, limit).map(adviseRow);
              respond(
                {
                  ok: true,
                  action: "advise",
                  source: "project",
                  project: project.name,
                  readOnly: true,
                  brief: briefText || project.brief,
                  rankedBy: briefText ? "fusion-rank" : "score-desc",
                  phase: phaseFilter,
                  count: rows.length,
                  rows,
                  note: "read-only pre-flight (consult BEFORE failing) — nothing was written; ranking is deterministic; telemetry is printed as-is: reproducedCount + counterEvidence are the live lesson-row fields on disk today (112 §3.1's verdict/scope/stale fields are not in the row schema — never fabricated here)",
                },
                0,
              );
              return;
            }
            if (!briefText) {
              return respond(
                {
                  ok: false,
                  error:
                    "lesson advise: --knowledge-file needs --brief to rank store rows (the store carries no score field — ranking is lexical; a blank brief has nothing to rank against). Use --project for the score-desc fallback.",
                  code: "RT_E_VALIDATION",
                },
                1,
              );
            }
            if (phaseFilter !== null) {
              return respond(
                {
                  ok: false,
                  error:
                    "lesson advise: --phase filters project-memory rows only — store entries carry no phase field; refusing to pretend the filter applied.",
                  code: "RT_E_VALIDATION",
                },
                1,
              );
            }
            const storePath = resolve(storeFile);
            const store = new k.KnowledgeStore(storePath);
            const found = store.findPatterns(briefText, Math.max(limit * 4, 20));
            const rows = found
              .map((match) => ({ match, cls: failClassOf(match.entry.tags, match.entry.body) }))
              .filter((x) => x.cls !== null)
              .slice(0, limit)
              .map(({ match, cls }) => ({
                id: match.entry.id,
                class: cls,
                level:
                  (Array.isArray(match.entry.tags) ? match.entry.tags : []).find((t) => /^L[1-5]$/.test(t)) ??
                  null,
                project: match.entry.project,
                title: match.entry.title,
                score: match.score,
                counterEvidence: Number.isFinite(match.entry.counterEvidence) ? match.entry.counterEvidence : 0,
                supersededBy: Array.isArray(match.entry.supersededBy) ? match.entry.supersededBy : [],
                advice: match.entry.body.replace(/\s+/g, " ").slice(0, 180),
              }));
            respond(
              {
                ok: true,
                action: "advise",
                source: "store",
                store: storePath,
                readOnly: true,
                brief: briefText,
                rankedBy: "fusion-rank",
                phase: null,
                count: rows.length,
                rows,
                note: "read-only pre-flight over the cross-project store — findPatterns excludes superseded/retired rows by default; nothing was written",
              },
              0,
            );
            return;
          }
          if (action === "verify") {
            // 216s (112 T5 · §3.3 proof-carrying lessons): re-hash the
            // artifact named by --anchor and compare it against every lesson
            // row's recorded evidenceHash= token → ok | stale | anchor-missing.
            // READ-ONLY by default; the ONLY mutating form is --mark-stale,
            // which writes the store's existing counterEvidence telemetry
            // (content fields untouched, append-only discipline kept) and is
            // refused for project rows, which have no telemetry writer.
            const anchorArg = requireArg(args, "anchor", "lesson verify");
            if (anchorArg.error !== undefined) {
              return respond(
                {
                  ok: false,
                  error: `${anchorArg.error} (the artifact whose current bytes the recorded evidenceHash= tokens are re-hashed against)`,
                  code: "RT_E_VALIDATION",
                },
                1,
              );
            }
            const hasProject = typeof args.project === "string" && args.project.trim() !== "";
            const storeFile = typeof args["knowledge-file"] === "string" ? args["knowledge-file"] : "";
            const hasStore = storeFile.trim() !== "";
            if (hasProject === hasStore) {
              return respond(
                {
                  ok: false,
                  error:
                    "lesson verify: pass exactly one source — --knowledge-file <store.json> (cross-project rows; the only source --mark-stale can write telemetry to) or --project <file.json> (project-local rows)",
                  code: "RT_E_VALIDATION",
                },
                1,
              );
            }
            const markStale = flag(args, "mark-stale");
            if (markStale && !hasStore) {
              return respond(
                {
                  ok: false,
                  error:
                    "lesson verify: --mark-stale needs --knowledge-file — the store's counterEvidence bump is the only machine telemetry writer; project-memory rows have none (refusing to pretend a write happened).",
                  code: "RT_E_VALIDATION",
                },
                1,
              );
            }
            const limit =
              typeof args.limit === "string" && /^\d+$/.test(args.limit) ? parseInt(args.limit, 10) : null;
            if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
              return respond(
                {
                  ok: false,
                  error: `lesson verify: --limit must be a positive integer (got ${String(args.limit)})`,
                  code: "RT_E_VALIDATION",
                },
                1,
              );
            }
            const anchorPath = resolve(anchorArg.value);
            let anchorText = null;
            try {
              anchorText = readFileSync(anchorPath, "utf8");
            } catch {
              anchorText = null; // an unresolved anchor is a REPORTED outcome, not an internal error
            }
            const { fnv1a } = await import("../src/lib/algorithms.ts");
            const anchorHash =
              anchorText === null
                ? null
                : { decimal: String(fnv1a(anchorText)), hex: fnv1a(anchorText).toString(16).padStart(8, "0") };
            const evidenceHashOf = (text) => {
              const m = typeof text === "string" ? text.match(/evidenceHash=([0-9a-fA-F]+)/) : null;
              return m ? m[1].toLowerCase() : null;
            };
            const check = (recorded) => {
              if (recorded === null) {
                return {
                  status: "anchor-missing",
                  reason: "row records no evidenceHash= token — nothing to re-hash against",
                };
              }
              if (anchorHash === null) {
                return {
                  status: "anchor-missing",
                  reason: `--anchor ${anchorPath} does not resolve to a readable file`,
                };
              }
              if (recorded === anchorHash.decimal || recorded === anchorHash.hex) {
                return { status: "ok", reason: "the anchor's current hash matches the row's recorded evidenceHash" };
              }
              return {
                status: "stale",
                reason: `the anchor's current hash (hex ${anchorHash.hex} / decimal ${anchorHash.decimal}) differs from the recorded ${recorded} — the proof no longer holds for these bytes`,
              };
            };
            const counts = { ok: 0, stale: 0, "anchor-missing": 0 };
            if (hasStore) {
              const storePath = resolve(storeFile);
              const store = new k.KnowledgeStore(storePath);
              const entries = store
                .entries()
                .filter((e) => Array.isArray(e.tags) && e.tags.includes("lesson"));
              const capped = limit === null ? entries : entries.slice(0, limit);
              const staleIds = [];
              const rows = capped.map((e) => {
                const recorded = evidenceHashOf(e.body);
                const outcome = check(recorded);
                counts[outcome.status] += 1;
                if (outcome.status === "stale") staleIds.push(e.id);
                return {
                  id: e.id,
                  source: "store",
                  title: e.title,
                  project: e.project,
                  recordedHash: recorded,
                  status: outcome.status,
                  reason: outcome.reason,
                  counterEvidence: Number.isFinite(e.counterEvidence) ? e.counterEvidence : 0,
                  supersededBy: Array.isArray(e.supersededBy) ? e.supersededBy : [],
                };
              });
              let marked = null;
              if (markStale) {
                marked = staleIds.map((id) => {
                  const updated = store.bumpCounterEvidence(id);
                  return {
                    id,
                    marked: updated !== null,
                    counterEvidence:
                      updated && Number.isFinite(updated.counterEvidence) ? updated.counterEvidence : null,
                  };
                });
              }
              respond(
                {
                  ok: true,
                  action: "verify",
                  source: "store",
                  store: storePath,
                  readOnly: !markStale,
                  anchor: anchorPath,
                  anchorPresent: anchorHash !== null,
                  anchorHash,
                  count: rows.length,
                  rowsOk: counts.ok,
                  stale: counts.stale,
                  anchorMissing: counts["anchor-missing"],
                  rows,
                  marked,
                  note: markStale
                    ? `telemetry-only write — counterEvidence bumped on ${(marked ?? []).filter((m) => m.marked).length} stale store row(s); content fields untouched (append-only discipline kept)`
                    : "read-only report — nothing was written (pass --mark-stale to bump counterEvidence on stale store rows; telemetry only)",
                },
                0,
              );
              return;
            }
            const project = loadProjectFor("lesson verify");
            const lessonRows = (project.memory ?? []).filter(
              (m) => m && typeof m === "object" && Array.isArray(m.tags) && m.tags.includes("lesson"),
            );
            const capped = limit === null ? lessonRows : lessonRows.slice(0, limit);
            const rows = capped.map((m) => {
              const recorded = evidenceHashOf(m.text);
              const outcome = check(recorded);
              counts[outcome.status] += 1;
              return {
                id: m.id,
                source: "project",
                phase: m.phase,
                recordedHash: recorded,
                status: outcome.status,
                reason: outcome.reason,
                reproducedCount: Number.isFinite(m.reproducedCount) ? m.reproducedCount : 0,
                counterEvidence: Number.isFinite(m.counterEvidence) ? m.counterEvidence : 0,
                evidence: m.text,
              };
            });
            respond(
              {
                ok: true,
                action: "verify",
                source: "project",
                project: project.name,
                readOnly: true,
                anchor: anchorPath,
                anchorPresent: anchorHash !== null,
                anchorHash,
                count: rows.length,
                rowsOk: counts.ok,
                stale: counts.stale,
                anchorMissing: counts["anchor-missing"],
                rows,
                marked: null,
                note: "read-only report over project-memory rows — --mark-stale is refused for this source (no machine telemetry writer); nothing was written",
              },
              0,
            );
            return;
          }
          // action === "refute"
          const file = requireArg(args, "knowledge-file", "lesson refute");
          if (file.error !== undefined) return respond({ ok: false, error: file.error, code: "RT_E_VALIDATION" }, 1);
          const id = requireArg(args, "id", "lesson refute");
          if (id.error !== undefined) return respond({ ok: false, error: id.error, code: "RT_E_VALIDATION" }, 1);
          const store = new k.KnowledgeStore(resolve(file.value));
          const updated = store.bumpCounterEvidence(id.value);
          if (!updated) {
            return respond(
              {
                ok: false,
                error: `lesson refute: no entry with id ${id.value} in ${resolve(file.value)}`,
                code: "RT_E_VALIDATION",
              },
              1,
            );
          }
          const counter = updated.counterEvidence ?? 0;
          const retired = counter >= k.LESSON_RETIRE_COUNTER;
          const evidence =
            typeof args.evidence === "string" && args.evidence.trim() ? args.evidence.trim() : null;
          respond(
            {
              ok: true,
              action: "refute",
              store: resolve(file.value),
              id: updated.id,
              counterEvidence: counter,
              retired,
              // The store rows record COUNTS only (append-only telemetry) —
              // the reason is echoed for the caller's own ledger/audit trail.
              evidence,
              note: retired
                ? "row RETIRED from read-back (counter-evidence at LESSON_RETIRE_COUNTER) — kept on disk for audit"
                : "counter-evidence bumped — read-back score decays by half per unit; store rows record counts only, keep the refute reason in your own ledger",
            },
            0,
          );
          return;
        } catch (err) {
          respond(
            { ok: false, error: err instanceof Error ? err.message : String(err), ...errCode(err, "RT_E_INTERNAL") },
            4,
          );
        }
        return;
      }

      case "wild": {
        // 308 B-02 (B2, C2 completion): the verb drives wildStep through
        // headless, so its wild.step_* telemetry rides the CALLER's onEvent
        // seam. Make the NDJSON appender explicitly available at this verb's
        // entry (no-op when main() already loaded it — cliLogEvent itself
        // no-ops while rtServer is null, so the hop can never throw).
        await ensureRtAppender();
        // Bounded headless wild-mode macro-run (engine.wildStep loop, default
        // 24 steps) + the full lifecycle the UI toggle offers: --start enables
        // Wild Mode AND begins a run (store startWildRun parity), --pause /
        // --resume / --stop control an active run, and the bare form steps an
        // already-active run. MUTATING: the stepped project is persisted back
        // to --project only when the run state actually changed (idempotent
        // no-op controls never rewrite the file).
        const actions = ["start", "pause", "resume", "stop"].filter((a) => flag(args, a));
        if (actions.length > 1) {
          return respond(
            {
              ok: false,
              error: `wild: pass at most one of --start|--pause|--resume|--stop (got ${actions.join(", ")})`,
              code: "RT_E_VALIDATION",
            },
            1,
          );
        }
        const action = actions[0] ?? "step";
        const path = requireProjectPath(args, "wild");
        // 174-3: pause/resume/step/stop must NOT force-stop a persisted active
        // run (CLI is the driver). --start still hydrates-stop so a crash
        // cannot silently resume without --resume.
        // 308 M3 (fuzz): this arm called h.loadProject RAW — the fuzz's 4
        // STACK(exit4) crashes (ENOENT/EISDIR/missing-id) all landed here while
        // the makeLoader guard (E-25) kept every other verb coded. Same classify
        // contract: read ENOENT → RT_E_PROJECT_MISSING; malformed → RT_E_VALIDATION.
        let project;
        if (action === "start") {
          project = loadProjectFor("wild");
        } else {
          try {
            project = h.loadProject(path, { preserveWildRun: true });
          } catch (err) {
            return respond(
              {
                ok: false,
                error: `wild: ${err instanceof Error ? err.message : String(err)}`,
                ...errCode(err, "RT_E_VALIDATION"),
              },
              1,
            );
          }
        }
        const steps =
          typeof args.steps === "string" && /^\d+$/.test(args.steps)
            ? parseInt(args.steps, 10)
            : undefined;
        // 308 B-02 (B2, C2 completion): the headless wild legs emit their
        // wild.step_* telemetry through the caller's onEvent seam; the CLI's
        // honest sink is cliLogEvent (NDJSON under logs/ via resolveLogDir —
        // seed shape matches wildStep's emits 1:1). Telemetry-side only: the
        // envelope and project bytes are untouched (no-op while rtServer null).
        // 313/T4.4 — THE AGENT SEAL: `--agent-seal` opts the run into the
        // classifier-as-approver path (coded [seat agent-seal] rows; never a
        // 'human' seat). The engine arms read opts.agentSeal; this is the
        // switch's last hop from the CLI.
        const agentSeal = flag(args, "agent-seal");
        const opts = {
          ...(steps ? { maxSteps: steps } : {}),
          ...(agentSeal ? { agentSeal: true } : {}),
          onEvent: (seed) => cliLogEvent(seed),
        };
        try {
          const res =
            action === "start"
              ? await h.wildStartRun(project, opts)
              : action === "pause"
                ? await h.wildPauseRun(project)
                : action === "resume"
                  ? await h.wildResumeRun(project)
                  : action === "stop"
                    ? await h.wildStopRun(project)
                    : await h.wildStartHeadless(project, opts);
          if (res.ok === false) {
            return respond(
              { ok: false, reason: res.reason, error: res.error, code: "RT_E_PHASE_ILLEGAL" },
              1,
            );
          }
          const changed = res.changed ?? true;
          if (changed) h.saveProject(path, res.project);
          respond(
            {
              ok: true,
              path,
              action,
              outcome: res.outcome,
              steps: res.steps,
              changed,
              summary: h.summary(res.project),
              // 185-H1: never dual-channel ok:true + error — detail rides as `note`.
              ...(res.note ? { note: res.note } : {}),
            },
            0,
          );
        } catch (err) {
          respond(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
              ...errCode(err, "RT_E_INTERNAL"),
            },
            4,
          );
        }
        return;
      }

      case "chat": {
        // Grounded copilot turn over the project (UI Chat tab parity): the
        // same chat.server.ts chatOnceServer the browser POSTs to — identical
        // context builder, caps and honesty, no server-fn wrapper needed under
        // bare Node. not-configured → 3 (RT_E_LLM_NOT_CONFIGURED); validation
        // → 1; provider/backend failure → 4.
        const project = loadProjectFor("chat");
        const ask = requireArg(args, "ask", "chat");
        if (ask.error !== undefined) return respond({ ok: false, error: ask.error, code: "RT_E_VALIDATION" }, 1);
        let history;
        if (typeof args.history === "string") {
          try {
            history = JSON.parse(args.history);
          } catch (err) {
            return respond(
              {
                ok: false,
                error: `chat: --history is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
                code: "RT_E_VALIDATION",
              },
              1,
            );
          }
          if (!Array.isArray(history)) {
            return respond(
              {
                ok: false,
                error: "chat: --history must be a JSON array of {role: \"user\"|\"assistant\", text} turns",
                code: "RT_E_VALIDATION",
              },
              1,
            );
          }
        }
        const res = await h.chatAsk(project, ask.value, history);
        if (res.ok === false) {
          const exit =
            res.code === "RT_E_VALIDATION"
              ? 1
              : res.reason === "not-configured"
                ? 3
                : 4;
          return respond(
            {
              ok: false,
              reason: res.reason,
              error: res.error ?? "chat unavailable",
              ...(res.code ? { code: res.code } : {}),
            },
            exit,
          );
        }
        respond(
          { ok: true, reply: res.reply, grounded: res.grounded, provenance: res.provenance },
          0,
        );
        return;
      }

      case "deepen": {
        // E-13 recovery for a completed research phase (0/7/11) whose recorded
        // gate failed with p7-research unmet — the path the UI's own fallback
        // text points at ("re-run research from the CLI instead"). MUTATING
        // when changed: the deepened project (fresh corpus entry/artifacts,
        // research.deepened log, re-recorded gate) is persisted back to
        // --project; an unchanged no-op never rewrites the file.
        const project = loadProjectFor("deepen");
        const phase =
          typeof args.phase === "string" && /^\d+$/.test(args.phase)
            ? parseInt(args.phase, 10)
            : project.currentPhase;
        if (!Number.isInteger(phase) || phase < 0 || phase > 12) {
          return respond(
            {
              ok: false,
              error: `deepen: --phase must be an integer 0-12 (got ${String(args.phase)})`,
              code: "RT_E_VALIDATION",
            },
            1,
          );
        }
        try {
          const res = await h.deepenPhase(project, phase);
          if (res.ok === false) {
            return respond(
              { ok: false, reason: res.reason, error: res.error, code: "RT_E_PHASE_ILLEGAL" },
              1,
            );
          }
          const path = requireProjectPath(args, "deepen");
          if (res.changed) h.saveProject(path, res.project);
          respond(
            {
              ok: true,
              // K7 item 8 (W40 N5): a bare `undefined` here made JSON.stringify
              // DROP the key for unchanged no-ops — consumers saw no `path` at
              // all. null is the explicit, shape-stable "not persisted".
              path: res.changed ? path : null,
              phase: res.phase,
              changed: res.changed,
              liveUnavailable: res.liveUnavailable,
              log: res.log,
            },
            0,
          );
        } catch (err) {
          respond(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
              ...errCode(err, "RT_E_INTERNAL"),
            },
            4,
          );
        }
        return;
      }

      case "doctor": {
        // E-25: capability pre-flight — no project required. Never throws.
        // 214: optional --tree scans leftover job files (never invents bodies).
        try {
          let tree = typeof args.tree === "string" && args.tree.trim() ? args.tree.trim() : "";
          // 326 F2d (T3 [NEW-BUG] · doctor --tree path honesty): two false-
          // clean classes closed here, both live-confirmed keyless.
          if (tree && process.platform === "win32") {
            // (a) MSYS drive forms. git-bash hands `/c/Users/...` to the CLI
            // verbatim, and resolve() on win32 reads it as <cwd>\c\Users\...
            // — a silent FALSE-EMPTY scan (the same tree via its Windows form
            // returns stubs:1; live bytes: t3_scratch/dryrun_doctor_game_msys
            // .txt vs …_win.txt). Translate the single-letter drive form
            // (git-bash's own /c/.. ⇄ C:\.. mapping — unambiguous) BEFORE
            // resolve(). Any other POSIX-literal --tree is refused rather
            // than mapped onto a drive root nobody named (browser-guard.mjs
            // R11-f06 class).
            if (/^\/[A-Za-z](\/|$)/.test(tree)) {
              tree = tree[1].toUpperCase() + ":" + (tree.length > 2 ? "\\" + tree.slice(3).replace(/\//g, "\\") : "\\");
            } else if (tree.startsWith("/") && !tree.startsWith("//")) {
              return respond(
                {
                  ok: false,
                  error: `doctor: --tree ${JSON.stringify(tree)} is a POSIX-style path — on win32 it has no unambiguous meaning (resolve() would silently scan a drive root the caller never named). Pass a Windows path (C:\\...) or an MSYS drive form (/c/...).`,
                  code: "RT_E_VALIDATION",
                  tree: null,
                },
                1,
              );
            }
          }
          if (tree) {
            // (b) a non-existent or non-directory --tree must never come back
            // ok:true/stubs:0/files:[] — that reads as a clean health bill for
            // a scan that never happened (T3 evidence: NOPE_XYZ exit 0). Same
            // coded-refusal class as `edit --dir`'s missing-dir guard.
            let treeStat = null;
            try {
              treeStat = statSync(tree);
            } catch {
              treeStat = null;
            }
            if (!treeStat) {
              return respond(
                {
                  ok: false,
                  error: `doctor: --tree ${JSON.stringify(tree)} does not exist — nothing to scan.`,
                  code: "RT_E_VALIDATION",
                  tree: resolve(tree),
                },
                1,
              );
            }
            if (!treeStat.isDirectory()) {
              return respond(
                {
                  ok: false,
                  error: `doctor: --tree ${JSON.stringify(tree)} is not a directory — nothing to scan.`,
                  code: "RT_E_VALIDATION",
                  tree: resolve(tree),
                },
                1,
              );
            }
          }
          const status = await h.doctorStatus({
            ...(tree ? { treeDir: tree } : {}),
            // W46 · 332-2: the project file's persisted run spend is the record
            // the operator actually asks about; without this the doctor arm
            // reported the fresh process's empty session ledger (`calls: 0`).
            ...(CLI_PROJECT ? { projectPath: CLI_PROJECT } : {}),
          });
          // 342-5: the MCP surface — owner-gated OFF by default. It reports the
          // gate truthfully and, only when RAPIDTOOL_MCP_ENABLED is set AND a
          // server is configured, the REAL tools/list. A disabled host spawns
          // nothing and lists nothing (never a fabricated list). `--mcp-call`
          // additionally exercises the F1 read-only round-trip on that client.
          const mcpFlag = args["mcp-call"];
          if (mcpFlag === true) {
            return respond(
              { ok: false, error: "doctor: --mcp-call needs a value (the tool name to call)", code: "RT_E_VALIDATION" },
              1,
            );
          }
          let mcpCallArgs;
          const rawCallArgs = args["mcp-call-args"];
          if (rawCallArgs !== undefined) {
            if (rawCallArgs === true) {
              return respond(
                { ok: false, error: "doctor: --mcp-call-args needs a value (a JSON object)", code: "RT_E_VALIDATION" },
                1,
              );
            }
            if (typeof rawCallArgs === "string" && rawCallArgs.trim()) {
              try {
                const parsed = JSON.parse(rawCallArgs);
                if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
                  throw new Error("must be a JSON object");
                }
                mcpCallArgs = parsed;
              } catch (err) {
                return respond(
                  {
                    ok: false,
                    error: `doctor: --mcp-call-args must be a JSON object — ${err instanceof Error ? err.message : String(err)}`,
                    code: "RT_E_VALIDATION",
                  },
                  1,
                );
              }
            }
          }
          const doc = await doctorDriver();
          const mcpCallRequested = typeof mcpFlag === "string" && mcpFlag.trim().length > 0;
          const mcp = await doc.doctorMcp({
            env: process.env,
            ...(mcpCallRequested ? { call: { tool: mcpFlag.trim(), args: mcpCallArgs ?? {} } } : {}),
          });
          // A plain `doctor` reports MCP as data (disabled is a status, not a
          // doctor failure). An EXPLICIT `--mcp-call` is a request: its refusal
          // is the process's coded failure (RT_E_MCP_DISABLED when off).
          if (mcpCallRequested && mcp.refusal) {
            return respond({ ok: false, error: mcp.refusal.error, code: mcp.refusal.code, mcp }, 1);
          }
          respond({ ok: true, ...status, mcp }, 0);
        } catch (err) {
          respond(
            {
              ok: false,
              error: `doctor failed: ${err instanceof Error ? err.message : String(err)}`,
              ...errCode(err, "RT_E_INTERNAL"),
            },
            4,
          );
        }
        return;
      }

      case "diagnose": {
        // The AI-agent diagnostic verb: one JSON — last N telemetry rows,
        // timeline, most-likely-cause heuristic, growth stats. No project
        // required; --project targets its .rapidtool/logs. Never throws.
        try {
          if (!rtDiag) rtDiag = await import(RT_DIAG_PATH);
          if (!rtEvents) rtEvents = await import(RT_EVENTS_PATH);
          const rows = rtServer
            ? rtServer.readRtTail(rtServer.resolveLogDir(CLI_PROJECT), 200)
            : [];
          // OPS-9 (K13, W40 N5): readRtTail returns NEWEST-first; the diagnosis
          // contract documents `errors` as OLDEST-first (diagnose.ts:83 — the
          // cited `errors[i]` evidence indices assume it) and the UI path
          // presents a chronological timeline. One reversed copy feeds both.
          const chronological = rows.slice().reverse();
          // OPS-10 helpers: the newest row for an event (chronological ⇒ scan back).
          const newestRow = (event) => {
            for (let i = chronological.length - 1; i >= 0; i -= 1) {
              if (chronological[i].event === event) return chronological[i];
            }
            return null;
          };
          const asFiniteNumber = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);
          const heartbeatRow = newestRow("sys.heartbeat");
          const hbLagRow = heartbeatRow ?? newestRow("sys.heartbeat_lag");
          const longTaskRow = newestRow("sys.longtask");
          const stallRow = newestRow("sys.mainthread_stall");
          /** @type {{ ok: boolean; lastError: string | null }} */
          let persistHealth = { ok: true, lastError: null };
          let name = null;
          let status = null;
          let currentPhase = null;
          let wildRun = null;
          // R12-f07: the growth surface below must carry REAL counts, not the
          // hardcoded zeros that made the detector inert (projectFile: 0 even
          // for a measured 158,302 B file). Filled inside the load block.
          let projectFileBytes = 0;
          let ledgerRowCount = 0;
          let chatLogRowCount = 0;
          if (typeof CLI_PROJECT === "string" && CLI_PROJECT.trim()) {
            try {
              // G2 (fixes/320): diagnose OBSERVES the persisted run — load it
              // with preserveWildRun so engine.hydrateWildRun cannot force-stop
              // a parked/active run into a read-time artifact (its browser-
              // hydrate default); pause/resume/step/stop load the same way
              // (this file's wild arm, :3543).
              const p = h.loadProject(CLI_PROJECT, { preserveWildRun: true });
              try {
                projectFileBytes = statSync(CLI_PROJECT).size;
              } catch {
                /* unstattable project file — honest 0 */
              }
              ledgerRowCount = Array.isArray(p.decisions) ? p.decisions.length : 0;
              chatLogRowCount = Array.isArray(p.chatLog) ? p.chatLog.length : 0;
              name = typeof p.name === "string" ? p.name : null;
              status = typeof p.status === "string" ? p.status : null;
              currentPhase = typeof p.currentPhase === "number" ? p.currentPhase : null;
              // G2 (fixes/320): the canonical projection now lives in
              // diagnose.ts (`projectWildRun`) — disk truth verbatim; overdueMs
              // derived ONLY for a progressing run (active && !pause), never a
              // growing `now - lastAutoAt` on a parked/stopped run.
              wildRun = rtDiag.projectWildRun(p.wildRun, Date.now());
            } catch (loadErr) {
              persistHealth = {
                ok: false,
                lastError: loadErr instanceof Error ? loadErr.message : String(loadErr),
              };
            }
          }
          // K7 item 9 (W40 N5): the checkpoint snapshot `resume`/`unattended`
          // would re-enter, read-only via checkpoint.server.ts:readCheckpoint
          // (present/path/savedAt only — never admits, never hydrates). The dir
          // is the project file's home (same resolution as the log dir above);
          // no --project → honest null (nothing to look beside).
          let checkpoint = null;
          if (typeof CLI_PROJECT === "string" && CLI_PROJECT.trim()) {
            try {
              const cpModule = await checkpointDriver();
              const cp = cpModule.readCheckpoint(resolveCheckpointTarget(CLI_PROJECT).dir);
              checkpoint = cp.ok
                ? { present: true, path: cp.path, savedAt: cp.checkpoint.savedAt }
                : cp.code === "RT_E_CHECKPOINT_MISSING"
                  ? { present: false, path: cp.path, savedAt: null }
                  : { present: false, path: cp.path, savedAt: null, code: cp.code, error: cp.error };
            } catch {
              /* checkpoint surface is advisory — the honest null stands */
            }
          }
          const diagnosis = rtDiag.buildDiagnosis({
            source: "cli",
            now: Date.now(),
            session: { sessionId: rtSessionId, host: "cli", href: "", ua: "" },
            project: {
              ref: CLI_PROJECT,
              name,
              status,
              currentPhase,
              wildRun,
            },
            errors: chronological.filter(
              (r) =>
                r.level === "error" ||
                r.level === "critical" ||
                // fixes/323 FIX-2c (F-3): exit-2 park rows ride the input so the
                // verdict NAMES the park (class `honest-park`) instead of
                // misreading it — true for new warn+parked rows AND for legacy
                // error-level exit-2 rows already on disk (the pre-fix bytes
                // read `level:"error", code:null`). buildDiagnosis separates
                // them; they are never counted as errors.
                rtDiag.isParkRow(r),
            ),
            // OPS-9: the NEWEST 50 rows, presented oldest-first (was
            // `rows.slice(-50)` = the window's OLDEST rows, in reverse).
            timeline: chronological.slice(-50).map((r) => ({
              ts: r.ts,
              kind: "telemetry",
              event: r.event,
              scope: r.scope,
              phase: r.phase ?? null,
              detailOrMessage: r.message,
            })),
            watchdog: {
              // OPS-10 (K13, W40 N5): derive from the same read — the old
              // hardcoded nulls hid rows that were sitting right here; an
              // absent row still lands as an honest null.
              lastHeartbeatAt: heartbeatRow ? heartbeatRow.ts : null,
              heartbeatLagMs: asFiniteNumber(hbLagRow?.payload?.lagMs),
              // A logged stall row is an OBSERVATION: the live latch is
              // client-side and cleared on resolve (rt-client.ts:344-357), so a
              // static log cannot prove `active`. since/stepElapsedMs carry the
              // observation; its presence still feeds diagnose's evidence line.
              stall: stallRow
                ? {
                    active: false,
                    since: stallRow.ts,
                    stepElapsedMs: asFiniteNumber(stallRow.payload?.lagMs) ?? 0,
                    class: "mainthread-stall",
                  }
                : null,
              lastLongTaskMs: asFiniteNumber(longTaskRow?.payload?.durationMs),
              // OPS-10b: budgets from their single authority (rt-events.ts —
              // the module diagnose.ts itself imports them from); the old
              // 255_000/60_000 literals + "keep in sync" note are gone.
              budgetsMs: { wildStep: rtEvents.WILD_STEP_BUDGET_MS, chat: rtEvents.CHAT_STEP_BUDGET_MS },
            },
            growth: {
              rows: { ledger: ledgerRowCount, telemetryRing: rows.length, chatLog: chatLogRowCount },
              bytes: {
                projectFile: projectFileBytes,
                // K7 item-5 class (W40 N5): module-absent = genuinely NOT
                // measured → null, never a fake 0 (the type permits null and
                // the UI path already reports null for what it cannot measure).
                logDirBytes: rtServer ? rtServer.logDirBytes(rtServer.resolveLogDir(CLI_PROJECT)) : null,
                localStorageEstimate: null,
              },
              counts: {},
            },
            persistHealth,
            crashSnapshot: null,
          });
          // K7 item 9 (W40 N5 + rendezvous fix): the computed checkpoint snapshot now
          // actually RIDES the envelope — it was computed and dropped (assigned-unused).
          respond({ ok: true, ...diagnosis, checkpoint }, 0);
        } catch (err) {
          respond(
            {
              ok: false,
              error: `diagnose failed: ${err instanceof Error ? err.message : String(err)}`,
              ...errCode(err, "RT_E_INTERNAL"),
            },
            4,
          );
        }
        return;
      }

      default:
        respond({ ok: false, error: `Unknown subcommand: ${cmd}`, usage: USAGE, code: "RT_E_VALIDATION" }, 1);
    }
  } catch (err) {
    // E-25: internal error → exit 4, stack on STDERR only (stdout stays one
    // parseable JSON object). Classify the OBJECT: a thrown `.code` (e.g.
    // phases.ts's RT_E_PHASE_ILLEGAL) survives; prose-only could not see it.
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error && err.stack ? err.stack : message;
    console.error(stack);
    respond({ ok: false, error: message, ...errCode(err, "RT_E_INTERNAL") }, 4);
  }
}

// The --project path (validated by loadProjectFor before any writer uses it).
function requireProjectPath(args, cmdName) {
  const proj = requireArg(args, "project", cmdName);
  if (proj.error !== undefined) respond({ ok: false, error: proj.error, code: "RT_E_VALIDATION" }, 1);
  return proj.value;
}

// ---------------------------------------------------------------------------
// The human seat — TWO channels (W29 LANE H · R5-f12 · R11-f04/C2-f02).
//
// The defect this closes: `approve` and `edit --write` read BOTH
// `humanSeatToken` and `expectedHumanSeatToken` from the SAME
// `process.env.RT_HUMAN_SEAT_TOKEN`, so policy.ts's `isVerifiedHumanSeatToken`
// collapsed to "the env var is non-empty" and the `human-seat-unverified`
// deny was unreachable from the CLI — any process that merely exported the
// variable (its own value!) minted `decidedBy:"human"`.
//
// Two channels now:
//   · Channel A (possession/claim) — RT_HUMAN_SEAT_TOKEN in the environment,
//     the out-of-band secret the human exports in their own shell.
//   · Channel B (presence/confirmation) — an interactive re-entry typed at a
//     TTY prompt; the environment cannot furnish a keystroke from a person.
// The TYPED value is the presented side; the env read stays the expected side
// (policy.ts remains a pure, env-free leaf). A non-TTY claim of the human
// seat is refused outright — no second channel exists there, so no human row
// may be minted. Honest ceiling: same-OS-user processes can always read
// env/files; this is an accountability control under the ledger-trust
// assumption, NOT a security boundary (README-cli.md §The `approve` seat
// states the same ceiling) — but it must never be VACUOUS again.
// ---------------------------------------------------------------------------
async function promptHumanSeatToken() {
  // The prompt goes to STDERR so stdout stays exactly one JSON object.
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = await new Promise((settle) => {
      let done = false;
      const finish = (value) => {
        if (!done) {
          done = true;
          settle(value);
        }
      };
      rl.question("Confirm human seat — re-enter RT_HUMAN_SEAT_TOKEN: ", (a) => finish(a));
      // EOF (Ctrl-D) closes the interface without answering: treat as an empty
      // presented token → the seam's human-seat-unverified deny, never a hang.
      rl.once("close", () => finish(""));
    });
    return typeof answer === "string" ? answer.trim() : "";
  } finally {
    rl.close();
  }
}

/**
 * Claim the human seat (Channel A + Channel B) or hand back a refusal.
 * Returns `{ error }` when no second channel exists, else
 * `{ actor, humanSeatToken (typed), expectedHumanSeatToken (env) }`.
 */
async function humanSeatClaim(cmd) {
  if (process.stdin.isTTY !== true) {
    // 314 F5 (K5): the machine pointer is CMD-AWARE. `approve` now has the
    // explicit `--seat autopilot` door (a non-TTY claim may take it); for
    // `fixtures` the action is human-only by policy (the autopilot seat is
    // denied) so no machine promise may be made; `edit` keeps the historical
    // autopilot fallback. The old shared "(omit --i-am-human)" clause named a
    // recovery that only held for one of the three verbs.
    const machineLine =
      cmd === "approve"
        ? "For an explicit MACHINE decision use `approve --project <p> --seat autopilot` — a bare call is never guessed a seat."
        : cmd === "reject"
          ? "For an explicit MACHINE rejection use `reject --project <p> --note <t> --seat autopilot` — a bare call is never guessed a seat."
          : cmd === "fixtures"
            ? "Approving fixtures is a human-only decision (the autopilot seat can never approve them) — run the verb from a terminal where a person can confirm."
            : "Use the autopilot seat instead (omit --i-am-human) or run the verb from a terminal where a person can confirm.";
    return {
      error:
        `${cmd}: --i-am-human refused — the human seat needs an interactive confirmation ` +
        `(re-enter RT_HUMAN_SEAT_TOKEN at the TTY prompt) and this stdin is not a TTY, so the ` +
        `environment alone cannot furnish a second channel. ${machineLine}`,
    };
  }
  return {
    actor: { decidedBy: "human", seat: "human-cli-i-am-human" },
    humanSeatToken: await promptHumanSeatToken(),
    expectedHumanSeatToken: process.env.RT_HUMAN_SEAT_TOKEN,
  };
}

const USAGE = {
  description: "File-based headless RapidTool driver (no browser).",
  help: "help | --help | -h [<verb>]   # print this synopsis as a SUCCESS envelope (ok:true, exit 0); name a verb (`--help emit`) to narrow `usage.commands` to that verb's line — a help request is never a coded failure",
  commands: {
    create: "create --brief <text|@file> [--name <text>] [--advisory] [--out <file.json>]   # --brief @<path> reads the file (a YAML-front-matter corpus fixture's `brief:` scalar is unwrapped); a bare value naming an EXISTING readable file is REFUSED (RT_E_VALIDATION) — a path is never silently used as prose; default out: <slug>.json in the CWD (intermediate control file); --advisory: advisory DoD gates even when DEEPSEEK_API_KEY is set (keyed runs default enforceDod ON)",
    run: "run --project <file.json> [--live] [--unattended] [--knowledge <store.json>]   # advance one phase; --unattended = autopilot+live forced until parked (the scheduler-facing twin is the `unattended` verb); --knowledge seeds the P6 expansion with human-accepted cross-project lesson rows (proven), same store->rows resolver as `packet`",
    gate: "gate --project <file.json> [--autopilot] [--live] [--unattended] [--knowledge <store.json>]  # advance until parked; --unattended forces autopilot+live; --knowledge as on run",
    resume: "resume --project <file.json|dir> [--autopilot] [--live]  # T-107.7: read the per-phase checkpoint written beside the project dir by run/gate, admit it (identity + mode + integer phase sanity), hydrate it, and re-enter the drive at the recorded phase; prints the snapshot age — exit taxonomy identical to gate (2 = parked). Never a silent resume",
    unattended: "unattended --project <file.json|dir> [--knowledge <store.json>]  # W-47: scheduler-facing drive — re-enter from a checkpoint when one exists (crash recovery), else start from the named project file; autopilot + live; a stock HITL gate (P4/P5/P8/P9) whose DoD passes is cleared through the ledgered machine actor (`approve --seat autopilot`), so only a forceHuman gate (or any red DoD gate) still parks (exit 2); NOT a daemon (a host hook — Windows Task Scheduler / cron — invokes it on a cadence); --knowledge as on run/gate",
    approve: "approve --project <file.json> (--i-am-human | --seat autopilot) [--force]   # the seat is never guessed, name exactly one: --i-am-human = human-seat claim — needs a TTY re-entry of the out-of-band RT_HUMAN_SEAT_TOKEN (refused on non-TTY); --seat autopilot = explicit MACHINE attribution (`decidedBy:\"autopilot\"`, seat harness; works non-TTY — the documented agent door for a parked gate); --agent-seal is REFUSED here (RT_E_VALIDATION) — the seal is a wild-run concept: `wild --start|--resume --agent-seal`",
    reject: "reject --project <file.json> --note <text> (--i-am-human | --seat autopilot)   # the seat is never guessed, name exactly one: --seat autopilot = explicit MACHINE attribution (works non-TTY — the documented agent door for rejecting a parked gate); --i-am-human = human-seat claim — needs a TTY re-entry of the out-of-band RT_HUMAN_SEAT_TOKEN (refused on non-TTY)",
    retry: "retry --project <file.json>                  # unlock a rejected/blocked phase",
    ingest: "ingest --project <file.json> --report <json|@file.json|->  # @file or '-' = stdin",
    packet: "packet --project <file.json> [--out <file.md>] [--knowledge <store.json>]  # --knowledge seeds the Ranked-memory section with cross-project accepted lesson rows (tier-1, advisory)",
    export: "export --project <file.json> [--out <file.json>]",
    emit: "emit --project <file.json> [--out <dir>] [--check] [--run] [--red-tree refuse|banner] [--verify-kind] [--force] [--require-verified] [--git]   # write the runnable scaffold; default out: <home>/RapidTool Software/<slug>/ (--out overrides); --check adds per-file compile verdicts; --run adds the TreeRunOutcome (compile + tests + entry smoke), exit 1 when the tree is not ok, exit 0 when it is ok (the envelope always carries declaredScriptsVerified/unverifiedDeclaredScripts when a declared script did not run); --require-verified opts into exit 5 for that green-but-unverified state; --red-tree banner admits an uncleared red tree-run WITH the unmissable banner on the emitted README (default refuse); --git lands the emitted tree as ONE Conventional-Commits delivery commit (feat(<slug>): <brief>) — emitted files only, a foreign file is reported not committed, the host repo is never a target, and a clean tree is a no-op (envelope `git`)",
    fixtures: "fixtures --project <file.json> (--draft | --approve --ids id1,id2 | --approve-all)  # draft brief-derived acceptance fixtures (always pending) OR approve selected/all ids — never auto-approves: --approve routes through the policy seam's human seat (--i-am-human + a TTY re-entry of RT_HUMAN_SEAT_TOKEN; a denied verdict writes nothing and stamps no decidedBy)",
    eval: "eval [--dir <eval-out>] [--history <history.json>] [--slug <slug>]  # T5.3 read-only eval scorecard: M1-M9 rubric + per-case rows + history deltas/trend read from research/eval-out/results.json + history.json (default dir <repo>/research/eval-out; $EVAL_OUT_DIR honored like run-eval.mjs; --dir overrides; --history overrides just the trend file; --slug filters to one corpus case). No keyed calls, nothing fabricated — the eval-out documents are never written (like every verb, the exit stamps one NDJSON telemetry row under <cwd>/.rapidtool/logs/); a missing history prints as 'no history', never a fake 0 delta",
    "tree-run": "tree-run --dir <dir> [--project <file.json>] [--require-verified]  # fixes/149 P0-1 emit→edit→re-emit oracle: compile-check treeRun over an EXISTING emitted dir — read-only, never re-emits over the dir (an edited file is never clobbered); green → 0 (the envelope still names an unverified declared toolchain; --require-verified turns that state into exit 5); red → 1 with the first not-ok tail + RT_E_TREE_RUN_FAILED; --project adds the hash-checked dirDirty divergence report (read-only, never persisted)",
    repair: "repair --dir <dir> --project <file.json> [--budget N]  # fixes/149 P0-1 continuation seam: re-import the EDITED tree files from the dir into project.generatedTree (path→content, hash-checked per file; refused paths are warnings, never silent drops) + run the journey's bounded repair cycle AGAINST the dir (treeRun → red tail → one bounded synthesis repair call with deps.treeFailure → apply repaired files in place → re-import → treeRun again); green → tested-equivalent mint + honest P6 gate + converged (0); budget exhausted → honest failed (1, RT_E_REPAIR_FAILED); the dir is the artifact, the project JSON the ledger (persisted after every completed run); default budget 3",
    edit: "edit --dir <dir> --file <relpath> --find <old> --replace <new> [--write] [--project <file.json>]  # 216s (108-T1): ONE in-place str_replace on an emitted tree file — DRY-RUN by default (the diff + would-be hashes are returned, nothing is written); --write (requires --project) applies atomically only after evaluatePolicy(\"repair.apply\", tree:<dir>) allows the seat, then lands ONE attributed ledger row (actor + decidedVia provenance + patch + before/after hashes); ambiguous / missing / no-op matches are coded refusals",
    summary: "summary --project <file.json>   # envelope: ok + summary incl. nextAction {kind,cmd,phase,why} — the SAME 7-arm vocabulary the console renders (run/approve/retry/done/running/fix-gate/unknown)",
    vault: "vault --project <file.json> [--out <dir>]   # one .md per note + _index.md MOC (default <home>/RapidTool Software/<slug>/vault)",
    search: "search --project <file.json> --query <text> [--limit <n>]  # token-overlap vault search",
    crew: "crew --project <file.json> [--max-steps <n>]  # advisory multi-agent crew (needs DEEPSEEK_API_KEY)",
    verify: "verify --project <file.json> [--apply]      # machine verify-fix on generatedSource; --apply persists the verdict",
    check: "check --dir <path>                          # per-file compile verdicts over an emitted dir (.js via node --check; .ts via the typescript devDep)",
    scan: "scan --dir <dir>                            # W23 L6 (G4 · OV-21): ADVISORY error-signal scan over an emitted dir — catch-empty + catch-swallowed + neutral-return-unimplemented; read-only, never a gate and never blocks an emit; exit 0 clean / 1 findings (RT_E_VALIDATION for an unreadable dir)",
    design: "design --project <file.json> [--html <out.html>]  # design tokens (+ standalone HTML when --html)",
    diagram: "diagram --project <file.json> --kind phases|architecture|flow [--out <file.svg>]  # SVG diagram",
    artifacts: "artifacts --project <file.json>           # index of project artifacts (id/phase/kind/title/bytes)",
    doctor: "doctor [--tree <dir>] [--mcp-call <tool>] [--mcp-call-args <json>]  # capability pre-flight (llm/research/runner/node/factory). The `mcp` field reports the owner-gated MCP client honestly: OFF by default (RAPIDTOOL_MCP_ENABLED unset) — zero child spawned, tools null with the coded RT_E_MCP_DISABLED refusal; only when enabled AND RAPIDTOOL_MCP_SERVER is configured is the server's REAL tools/list returned (never fabricated). --mcp-call additionally runs the read-only round-trip for that tool",
    diagnose: "diagnose [--project <file.json>]           # one-shot telemetry diagnosis from the NDJSON log tail: timeline + most-likely-cause heuristic + growth stats (no project required)",
    harvest: "harvest --project <file.json>               # bounded live-source harvest (repos/license/snippets) for the brief",
    swarm: "swarm --project <file.json>                  # deterministic advisory swarm critique of the current phase",
    prompt: "prompt --project <file.json> [--policies a,b]  # hyper-prompt expansion (needs DEEPSEEK_API_KEY)",
    bench: "bench --project <file.json>                  # synthetic estimates: tokens/time/complexity/failure points",
    mine: "mine --dir <path> [--limit N]                # bounded structural codebase map + convention map",
    knowledge: "knowledge --store <file.json> (--save <json>|--find <query>) [--limit N]  # cross-project pattern store",
    lesson: "lesson (--list --project <file.json> [--brief <text>] [--limit N] | --propose --brief <text> [--title <t>] [--kind fix|pattern|note] [--tags a,b] [--project <name>] | --accept --project <file.json> --out <knowledge.json> [--actor <name>] [--limit N] | --supersede --knowledge-file <knowledge.json> --id <K...> [--evidence <text>|--reason <text>] [--by human|machine] | --refute --knowledge-file <knowledge.json> --id <K...> [--evidence <text>] | --advise (--project <file.json> | --knowledge-file <knowledge.json>) [--brief <text>] [--phase N] [--limit N] | --verify (--knowledge-file <knowledge.json> | --project <file.json>) --anchor <path> [--mark-stale] [--limit N] | --effect --project <file.json>)  # lesson family: list rows read-only (fusionRank vs --brief, else score-desc) / propose = bounded flash DRAFT, never writes (keyless drafts labeled 'draft (keyless)') / accept = THE human-gated cross-project write, actor recorded per row, idempotent per actor / supersede + refute = store telemetry (append-only rows + counters, never deletes) / advise = read-only ranked FAIL-class pre-flight (reproducedCount + counterEvidence printed as-is) / verify = anchor re-hash → ok | stale | anchor-missing (read-only unless --mark-stale: store counterEvidence telemetry only) / effect = F3 read-only cross-run learning MEASUREMENT (recurrence census: reproduced/unreproduced, per-class rates + per-row evidence with the accruing lesson.reproduced ledger rows; recurrence ≠ causation, census window, n≥2 'baseline only' floor — never an eval score)",
    wild: "wild --project <file.json> [--start|--pause|--resume|--stop] [--steps N] [--agent-seal]  # wild-mode macro-run; --start enables + begins a run; --agent-seal = THE agent seal (a wild-run concept — the ONLY verb that accepts it): classifier-as-approver (coded [seat agent-seal] rows, never a human seat), bounded reject retries, ONE DoD-repair pass on a hard-DoD red",
    chat: "chat --project <file.json> --ask <text> [--history <json-array>]  # grounded copilot turn; slash tools /status /gate /packet /fixtures /ls /read /help work keyless; free-text needs DEEPSEEK_API_KEY",
    deepen: "deepen --project <file.json> [--phase N]    # re-run live research over a completed research phase (0/7/11)",
  },
};

// ---------------------------------------------------------------------------
// M6-05/M6-06 (B1 · fixes/310): the Node-side global nets. The CLI contract is
// ONE JSON object on stdout + the exit taxonomy (0/1/2/3/4/5; 5 = `emit --run` /
// `tree-run` green-but-unverified declared scripts), but `main()`'s
// internal try/catch only wraps the dispatch below its first awaits — a
// rejection from ensureErrorCodes()/ensureRtAppender() (or any uncaught throw
// later in the process) used to exit with a bare Node stack and NO envelope
// (308 map6 M6-05/06). The browser client carries its own nets
// (rt-client.ts:411-454); Node gets the same shape here: ONE
// `exitInternalError` seam — stack on stderr only, then the SAME respond()
// envelope the internal catch emits (ok:false + RT_E_INTERNAL + exit 4).
// Pinned by scripts/cli-exit-taxonomy.test.mjs (source-text legs + behavioral
// spawns that inject a real unhandled rejection / uncaught throw).
// ---------------------------------------------------------------------------
function exitInternalError(err) {
  try {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error && err.stack ? err.stack : message;
    console.error(stack);
    respond({ ok: false, error: message, ...errCode(err, "RT_E_INTERNAL") }, 4);
  } catch {
    // respond() itself failed (fd 1 unusable and the async fallback too):
    // last-resort exit — still non-zero, still one shape attempted.
    try {
      process.stderr.write(`cli: internal error: ${String(err)}\n`);
    } catch {
      // The process is already past a failed stdout write AND a failed
      // stderr write — the descriptor pair is gone. Nothing left to report
      // through; exit non-zero without masking the original error.
    }
    process.exit(4);
  }
}

// The nets register BEFORE main() runs, so even a synchronous throw in its
// prologue is covered. `uncaughtException` is safe to observe here — we always
// exit immediately (a one-shot CLI has no state worth resuming).
process.on("unhandledRejection", (reason) => exitInternalError(reason));
process.on("uncaughtException", (err) => exitInternalError(err));
main().catch(exitInternalError);
