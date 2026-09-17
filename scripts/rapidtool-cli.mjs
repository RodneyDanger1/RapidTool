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
//   node --experimental-strip-types scripts/rapidtool-cli.mjs create --brief "..." --name "..." --out build.json
//   node --experimental-strip-types scripts/rapidtool-cli.mjs run     --project build.json [--live]
//   node --experimental-strip-types scripts/rapidtool-cli.mjs gate    --project build.json [--autopilot] [--live]
//   node --experimental-strip-types scripts/rapidtool-cli.mjs approve --project build.json [--force]
//   node --experimental-strip-types scripts/rapidtool-cli.mjs reject  --project build.json --note "..."
//   node --experimental-strip-types scripts/rapidtool-cli.mjs retry   --project build.json                  # unlock a rejected/blocked phase
//   node --experimental-strip-types scripts/rapidtool-cli.mjs ingest  --project build.json --report '@report.json' | '-'
//   node --experimental-strip-types scripts/rapidtool-cli.mjs packet  --project build.json [--out packet.md]
//   node --experimental-strip-types scripts/rapidtool-cli.mjs export  --project build.json [--out out.json]
//   node --experimental-strip-types scripts/rapidtool-cli.mjs vault   --project build.json [--out <dir>]      # default: <home>/RapidTool Software/<slug>/vault
//   node --experimental-strip-types scripts/rapidtool-cli.mjs emit    --project build.json [--out <dir>] [--check] [--run]   # default: <home>/RapidTool Software/<slug>/; --check = per-file compile verdicts; --run = compile + tests + entry smoke (TreeRunOutcome)
//   node --experimental-strip-types scripts/rapidtool-cli.mjs tree-run --dir <dir> [--project build.json]                  # fixes/149 P0-1: compile-check treeRun over an EXISTING emitted dir — read-only, never re-emits, never clobbers (exit 1 on red with the first not-ok tail); --project adds the hash-checked dirDirty divergence report
//   node --experimental-strip-types scripts/rapidtool-cli.mjs repair  --dir <dir> --project build.json [--budget N]        # fixes/149 P0-1: hash-checked dir→ledger re-import + bounded repair cycle against the dir (treeRun → red tail → synthesis w/ deps.treeFailure → apply → re-import → treeRun); green → tested-mint + converged (exit 0); budget exhausted → honest failed (exit 1, RT_E_REPAIR_FAILED)
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
//   node --experimental-strip-types scripts/rapidtool-cli.mjs wild    --project build.json [--start|--pause|--resume|--stop] [--steps 24]  # --start enables + begins a run; default steps an active run
//   node --experimental-strip-types scripts/rapidtool-cli.mjs chat    --project build.json --ask "..." [--history '[{"role":"user","text":"..."}]']   # grounded copilot turn (needs DEEPSEEK_API_KEY)
//   node --experimental-strip-types scripts/rapidtool-cli.mjs deepen  --project build.json [--phase 7]     # re-run live research over a completed research phase (0/7/11)
//   node --experimental-strip-types scripts/rapidtool-cli.mjs lesson  --list --project build.json [--brief "…"] [--limit N]     # read-only: the project's lesson rows (kind/class/phase/score/evidence); --brief ranks via topLessonRows (fusionRank), else score-desc
//   node --experimental-strip-types scripts/rapidtool-cli.mjs lesson  --propose --brief "raw evidence…" [--project NAME] [--kind fix|pattern|note] [--tags a,b] [--title "…"]   # bounded flash DRAFT (never writes; keyed: one DeepSeek turn; keyless: labeled deterministic draft)
//   node --experimental-strip-types scripts/rapidtool-cli.mjs lesson  --accept --project build.json --out lessons.json [--actor NAME] [--limit N]  # THE human-gated cross-project lesson write (top FusionRank rows → knowledge store)
//   node --experimental-strip-types scripts/rapidtool-cli.mjs lesson  --supersede --knowledge-file lessons.json --id K1a2b3c4d [--evidence "…"]  # append-only supersede (new row + markSuperseded)
//   node --experimental-strip-types scripts/rapidtool-cli.mjs lesson  --refute --knowledge-file lessons.json --id K1a2b3c4d [--evidence "…"]   # counter-evidence bump (decay/retire)
//   node --experimental-strip-types scripts/rapidtool-cli.mjs packet  --project build.json [--knowledge lessons.json]        # tier-1: seed Ranked memory with accepted cross-project lessons
// ---------------------------------------------------------------------------
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// E-25: every result object carries schema_version + cmd + exit_code.
const SCHEMA_VERSION = 1;
let CMD = null;

// ---------------------------------------------------------------------------
// Arg parsing (--flag value | --flag=value, plus bare boolean flags).
// ---------------------------------------------------------------------------
function parseArgs(argv) {
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

// E-25: single JSON object on stdout + the machine exit code. Every result
// gains schema_version/cmd/exit_code; the legacy `ok` field is kept. Every
// {ok:false} envelope additionally gains `code` — a stable RT_E_* id from
// classifyError (src/lib/errors.ts) — additive, exit-code taxonomy unchanged.
// Sites that already set their own `code` pass through untouched.
async function respond(result, exitCode) {
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
  out.exit_code = exitCode;
  // G/E: stamp every CLI exit into the headless NDJSON event log (best-effort
  // — the appender itself must never break the exit path).
  try {
    if (typeof cliLogEvent === "function") {
      await cliLogEvent({
        level: exitCode === 0 ? "info" : "error",
        scope: "cli-command",
        event: `cli.${CMD ?? "command"}.${exitCode === 0 ? "ok" : "exit"}`,
        message: out.ok === false && typeof out.error === "string" ? out.error.slice(0, 200) : `exit ${exitCode}`,
        code: typeof out.code === "string" ? out.code : undefined,
        payload: { exitCode },
      });
    }
  } catch {
    /* never break the exit path */
  }
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
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
let classify = () => null; // prose classifier — omit `code` when module absent
let classifyErr = () => null; // object classifier (same module)
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
      const safe = (code) =>
        typeof code === "string" && /^RT_E_[A-Z0-9_]+$/.test(code) ? code : null;
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
// G: headless NDJSON event log (runtime-log.server.ts, same lazy mechanics).
// cliLogEvent(seed) stamps + appends one row under logs/ (best-effort).
// ---------------------------------------------------------------------------
const RT_PATH = pathToFileURL(
  join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "runtime-log.server.ts"),
).href;
const RT_DIAG_PATH = pathToFileURL(
  join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "diagnose.ts"),
).href;

let rtServer = null;
let rtDiag = null;
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

async function cliLogEvent(seed) {
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
// Subcommands.
// ---------------------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  CMD = cmd ?? null;
  CLI_PROJECT = typeof args.project === "string" ? args.project : null;

  await ensureErrorCodes(); // failures carry `code` (RT_E_*) on every envelope
  await ensureRtAppender(); // G: NDJSON event log under logs/ for every command

  if (!cmd) {
    respond({ ok: false, error: "Missing subcommand.", usage: USAGE, code: "RT_E_VALIDATION" }, 1);
    return;
  }

  // E-25: shared project loader — missing/bad project file is a usage-class
  // error (exit 1), never an internal error (exit 4).
  const makeLoader = (h) => (cmdName) => {
    const proj = requireArg(args, "project", cmdName);
    if (proj.error) respond({ ok: false, error: proj.error, code: "RT_E_VALIDATION" }, 1);
    try {
      return h.loadProject(proj.value);
    } catch (err) {
      // Classify the OBJECT: a read ENOENT → RT_E_PROJECT_MISSING; a malformed
      // project file (JSON/shape) → RT_E_VALIDATION. Prose could not tell them apart.
      respond(
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
        if (brief.error) return respond({ ok: false, error: brief.error, code: "RT_E_VALIDATION" }, 1);
        let project = h.createProject({ brief: brief.value, name: args.name });
        // fixes/132 (C2): keyed runs default enforceDod ON (hard DoD gates);
        // --advisory restores advisory-only behavior. The flip happens before
        // anything observes the project — the saved file carries the flag.
        if (flag(args, "advisory")) project = { ...project, enforceDod: false };
        // fixes/144 (M1): create's default STAYS CWD-relative <slug>.json — the
        // project JSON is an intermediate control file that every later verb
        // consumes via --project, so it must stay next to the shell chaining the
        // verbs (g4 F1 keeps it; only the DELIVERABLE emit + vault moved home).
        const out = resolve(typeof args.out === "string" ? args.out : `${h.filename(project.name)}.json`);
        h.saveProject(out, project);
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
        const project = loadProjectFor(cmd);
        const path = requireProjectPath(args, cmd);
        const autopilot = cmd === "gate" ? flag(args, "autopilot") : false;
        const live = flag(args, "live");
        const maxSteps = cmd === "run" ? 1 : undefined; // run = single step; gate = until parked
        const res = await h.runUntilGate(project, { autopilot, live, maxSteps });
        h.saveProject(path, res.project);
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
              code: "RT_E_GATE_PENDING",
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

      case "approve": {
        const project = loadProjectFor("approve");
        if (project.status !== "awaiting_hitl" || !project.hitl) {
          return respond(
            { ok: false, error: `No pending gate to approve (status: ${project.status}).`, code: "RT_E_GATE_PENDING" },
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
        // the autopilot gate; it may not impersonate the human seat by default.
        if (process.stdin.isTTY !== true && !flag(args, "i-am-human")) {
          return respond(
            {
              ok: false,
              error:
                "approve from a non-TTY requires --i-am-human (never mint decidedBy:human from an agent; use the autopilot gate for machine approval)",
              code: "RT_E_VALIDATION",
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
        // gate:P<phase>. The --i-am-human flag is the human-seat claim; the
        // out-of-band RT_HUMAN_SEAT_TOKEN is read HERE (policy.ts is a pure,
        // env-free leaf — its purity test pins that it never reads env). The
        // non-TTY guard above stays deliberately STRICTER than the seam: an
        // unattended process must name the human seat explicitly.
        const { evaluatePolicy } = await import("../src/lib/policy.ts");
        const policyVerdict = evaluatePolicy(
          flag(args, "force") ? "hitl.force" : "hitl.approve",
          `gate:P${project.hitl.phase}`,
          {
            actor: flag(args, "i-am-human")
              ? { decidedBy: "human", seat: "human-cli-i-am-human" }
              : { decidedBy: "autopilot", seat: "harness" },
            humanSeatToken: process.env.RT_HUMAN_SEAT_TOKEN,
            expectedHumanSeatToken: process.env.RT_HUMAN_SEAT_TOKEN,
          },
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
        const updated = h.approve(project, { force: flag(args, "force"), actor: flag(args, "i-am-human") ? { decidedBy: "human", seat: "human-cli-i-am-human" } : undefined, humanSeatToken: process.env.RT_HUMAN_SEAT_TOKEN });
        h.saveProject(requireProjectPath(args, "approve"), updated);
        respond({ ok: true, path: requireProjectPath(args, "approve"), summary: h.summary(updated) }, 0);
        return;
      }

      case "reject": {
        const project = loadProjectFor("reject");
        if (project.status !== "awaiting_hitl" || !project.hitl) {
          return respond(
            { ok: false, error: `No pending gate to reject (status: ${project.status}).`, code: "RT_E_GATE_PENDING" },
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
        if (note.error) return respond({ ok: false, error: note.error, code: "RT_E_VALIDATION" }, 1);
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
        const updated = h.reject(project, note.value);
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
        if (reportArg.error) return respond({ ok: false, error: reportArg.error, code: "RT_E_VALIDATION" }, 1);
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
        let text;
        if (typeof args.knowledge === "string" && args.knowledge.trim()) {
          try {
            const k = await knowledgeDriver();
            const store = new k.KnowledgeStore(resolve(args.knowledge));
            const proven = store.injectProven(project.name, { limit: 5 });
            const seeds = proven.map((p) => k.provenToLessonRow(p));
            const pkt = await packetDriver();
            text = pkt.compileAgentPacket(project, { proven: seeds });
          } catch (err) {
            return respond(
              {
                ok: false,
                error: `packet: cannot seed tier-1 lessons from ${args.knowledge}: ${err instanceof Error ? err.message : String(err)}`,
                ...errCode(err, "RT_E_INTERNAL"),
              },
              1,
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
          if (args.out === true) {
            return respond(
              { ok: false, error: "emit --out requires a path (got a flag with no value)", code: "RT_E_VALIDATION" },
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
          const res = await h.emitProject(project, target, { force: flag(args, "force") });
          if (!res.ok) {
            respond({ ok: false, error: res.error, code: res.code ?? "RT_E_VALIDATION", foreign: res.foreign }, 1);
            return;
          }
          const payload = {
            ok: true,
            dir: res.dir,
            count: res.files.length,
            moduleEmbedded: res.moduleEmbedded,
            summary: res.summary,
          };
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
          if (flag(args, "verify-kind")) {
            const cc = await checkDriver();
            const vk = cc.verifyKindDir(res.dir);
            payload.verifyKind = vk;
            if (!vk.ok) {
              payload.ok = false;
              payload.error = vk.detail ?? "verify-kind failed";
              payload.code = "RT_E_VERIFY_KIND_FAILED";
            }
          }
          if (flag(args, "check")) {
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
          if (flag(args, "run")) {
            const cc = await checkDriver();
            const outcome = await cc.treeRun(res.dir);
            payload.treeRun = outcome;
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
          }
          respond(payload, payload.ok ? 0 : 1);
        } catch (err) {
          respond(
            { ok: false, error: err instanceof Error ? err.message : String(err), ...errCode(err, "RT_E_INTERNAL") },
            1,
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
            delete next.acceptanceApprovedAt;
            h.saveProject(outPath, next);
            respond({
              ok: true,
              drafted: draft.cases.length,
              redCards: draft.redCards,
              pending: merged.filter((c) => c.approval === "pending").length,
              approvedKept: merged.filter((c) => c.approval === "approved").length,
              note: "draft is pending — run fixtures --approve --ids … or --approve-all (never auto)",
            });
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
            const approved = bf.approveFixtureCases(current, ids);
            const next = { ...project, acceptanceFixtures: approved, acceptanceApprovedAt: Date.now() };
            h.saveProject(outPath, next);
            respond({
              ok: true,
              approved: ids,
              pending: approved.filter((c) => c.approval === "pending").length,
            });
            return;
          }
          respond({ ok: false, error: "fixtures requires --draft or --approve", code: "RT_E_VALIDATION" }, 1);
        } catch (err) {
          respond(
            { ok: false, error: err instanceof Error ? err.message : String(err), ...errCode(err, "RT_E_INTERNAL") },
            1,
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
        if (dirArg.error) return respond({ ok: false, error: dirArg.error, code: "RT_E_VALIDATION" }, 1);
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
            } catch {
              /* advisory only */
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
          respond(payload, payload.ok ? 0 : 1);
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
        if (dirArg.error) return respond({ ok: false, error: dirArg.error, code: "RT_E_VALIDATION" }, 1);
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
          const res = await h.repairTreeDir(project, resolve(dirArg.value), { budget });
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
          if (args.out === true) {
            return respond(
              { ok: false, error: "vault --out requires a path (got a flag with no value)", code: "RT_E_VALIDATION" },
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
          // Missing vault module / write failure → clean exit 1 (documented).
          respond(
            { ok: false, error: err instanceof Error ? err.message : String(err), ...errCode(err, "RT_E_INTERNAL") },
            1,
          );
        }
        return;
      }

      case "search": {
        const project = loadProjectFor("search");
        const query = requireArg(args, "query", "search");
        if (query.error) return respond({ ok: false, error: query.error, code: "RT_E_VALIDATION" }, 1);
        try {
          const limit =
            typeof args.limit === "string" && /^\d+$/.test(args.limit) ? parseInt(args.limit, 10) : 10;
          const results = await h.vaultSearch(project, query.value, limit);
          respond({ ok: true, query: query.value, count: results.length, results }, 0);
        } catch (err) {
          respond(
            { ok: false, error: err instanceof Error ? err.message : String(err), ...errCode(err, "RT_E_INTERNAL") },
            1,
          );
        }
        return;
      }

      case "crew": {
        const project = loadProjectFor("crew");
        const opts = {};
        if (typeof args.maxSteps === "string" && /^\d+$/.test(args.maxSteps)) {
          opts.maxSteps = parseInt(args.maxSteps, 10);
        }
        const res = await h.runCrew(project, opts);
        if (res.ok === false) {
          const hint =
            res.reason === "not-configured"
              ? " — set DEEPSEEK_API_KEY in the environment to enable the crew"
              : "";
          const error =
            typeof res.error === "string" && res.error
              ? `${res.error}${hint}`
              : `crew unavailable (${res.reason ?? "error"})${hint}`;
          // E-25: backend not configured → 3; runtime/backend failure → 4.
          return respond({ ok: false, reason: res.reason, error }, res.reason === "not-configured" ? 3 : 4);
        }
        respond({ ok: true, messages: res.messages, artifacts: res.artifacts, stopped: res.stopped }, 0);
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
        if (dirArg.error) return respond({ ok: false, error: dirArg.error, code: "RT_E_VALIDATION" }, 1);
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

      case "design": {
        const project = loadProjectFor("design");
        try {
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
            1,
          );
        }
        return;
      }

      case "diagram": {
        const project = loadProjectFor("diagram");
        const kind = requireArg(args, "kind", "diagram");
        if (kind.error) return respond({ ok: false, error: kind.error, code: "RT_E_VALIDATION" }, 1);
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
            1,
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
            1,
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
            1,
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
              ? " — set DEEPSEEK_API_KEY in the environment to enable prompt expansion"
              : "";
          const error =
            typeof res.error === "string" && res.error
              ? `${res.error}${hint}`
              : `prompt expansion unavailable (${res.reason ?? "error"})${hint}`;
          return respond({ ok: false, reason: res.reason, error }, res.reason === "not-configured" ? 3 : 4);
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
            1,
          );
        }
        return;
      }

      case "mine": {
        // Bounded structural codebase map of a real directory (no project
        // needed). Every skip (non-source, too large, over limit) is reported.
        const dir = requireArg(args, "dir", "mine");
        if (dir.error) return respond({ ok: false, error: dir.error, code: "RT_E_VALIDATION" }, 1);
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
        if (store.error) return respond({ ok: false, error: store.error, code: "RT_E_VALIDATION" }, 1);
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
          } else {
            const limit =
              typeof args.limit === "string" && /^\d+$/.test(args.limit) ? parseInt(args.limit, 10) : 5;
            const matches = await h.knowledgeFind(resolve(store.value), find, limit);
            respond({ ok: true, count: matches.length, matches }, 0);
          }
        } catch (err) {
          respond(
            { ok: false, error: err instanceof Error ? err.message : String(err), ...errCode(err, "RT_E_INTERNAL") },
            1,
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
        const actions = ["list", "propose", "accept", "supersede", "refute"].filter((a) => flag(args, a));
        if (actions.length !== 1) {
          return respond(
            {
              ok: false,
              error: `lesson: pass exactly one of --list|--propose|--accept|--supersede|--refute (got ${actions.length})`,
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
              const cls = tags.find(
                (t) => t !== "lesson" && !/^L[1-5]$/.test(t) && t !== "accepted",
              ) ?? null;
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
          if (action === "propose") {
            // Bounded flash DRAFT only — this arm never writes. Keyless (or a
            // failed/absent keyed turn) → the deterministic keyword draft via
            // knowledge.ts proposeLessonFallback, labeled mode:"keyless".
            const brief = requireArg(args, "brief", "lesson propose");
            if (brief.error) return respond({ ok: false, error: brief.error, code: "RT_E_VALIDATION" }, 1);
            const kind = ["fix", "pattern", "note"].includes(args.kind) ? args.kind : "note";
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
            if (out.error) return respond({ ok: false, error: out.error, code: "RT_E_VALIDATION" }, 1);
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
            if (file.error) return respond({ ok: false, error: file.error, code: "RT_E_VALIDATION" }, 1);
            const id = requireArg(args, "id", "lesson supersede");
            if (id.error) return respond({ ok: false, error: id.error, code: "RT_E_VALIDATION" }, 1);
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
          // action === "refute"
          const file = requireArg(args, "knowledge-file", "lesson refute");
          if (file.error) return respond({ ok: false, error: file.error, code: "RT_E_VALIDATION" }, 1);
          const id = requireArg(args, "id", "lesson refute");
          if (id.error) return respond({ ok: false, error: id.error, code: "RT_E_VALIDATION" }, 1);
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
            1,
          );
        }
        return;
      }

      case "wild": {
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
        const project =
          action === "start"
            ? loadProjectFor("wild")
            : h.loadProject(path, { preserveWildRun: true });
        const steps =
          typeof args.steps === "string" && /^\d+$/.test(args.steps)
            ? parseInt(args.steps, 10)
            : undefined;
        const opts = steps ? { maxSteps: steps } : {};
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
            1,
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
        if (ask.error) return respond({ ok: false, error: ask.error, code: "RT_E_VALIDATION" }, 1);
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
              path: res.changed ? path : undefined,
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
            1,
          );
        }
        return;
      }

      case "doctor": {
        // E-25: capability pre-flight — no project required. Never throws.
        // 214: optional --tree scans leftover job files (never invents bodies).
        try {
          const tree = typeof args.tree === "string" && args.tree.trim() ? args.tree.trim() : "";
          const status = await h.doctorStatus(tree ? { treeDir: tree } : undefined);
          respond({ ok: true, ...status }, 0);
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
          const rows = rtServer
            ? rtServer.readRtTail(rtServer.resolveLogDir(CLI_PROJECT), 200)
            : [];
          let persistHealth = { ok: true, lastError: null };
          let name = null;
          let status = null;
          let currentPhase = null;
          let wildRun = null;
          if (typeof CLI_PROJECT === "string" && CLI_PROJECT.trim()) {
            try {
              const p = h.loadProject(CLI_PROJECT);
              name = typeof p.name === "string" ? p.name : null;
              status = typeof p.status === "string" ? p.status : null;
              currentPhase = typeof p.currentPhase === "number" ? p.currentPhase : null;
              const wr = p.wildRun;
              if (wr && typeof wr === "object") {
                const lastAutoAt = typeof wr.lastAutoAt === "number" ? wr.lastAutoAt : null;
                wildRun = {
                  active: wr.active === true,
                  pause: wr.pause === true,
                  phase: typeof wr.phase === "number" ? wr.phase : null,
                  startedAt: typeof wr.startedAt === "number" ? wr.startedAt : null,
                  lastAutoAt,
                  lastAutoLog: typeof wr.lastAutoLog === "string" ? wr.lastAutoLog : null,
                  stoppedAt: typeof wr.stoppedAt === "number" ? wr.stoppedAt : null,
                  overdueMs: lastAutoAt != null ? Date.now() - lastAutoAt : null,
                };
              }
            } catch (loadErr) {
              persistHealth = {
                ok: false,
                lastError: loadErr instanceof Error ? loadErr.message : String(loadErr),
              };
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
            errors: rows.filter((r) => r.level === "error" || r.level === "critical"),
            timeline: rows.slice(-50).map((r) => ({
              ts: r.ts,
              kind: "telemetry",
              event: r.event,
              scope: r.scope,
              phase: r.phase ?? null,
              detailOrMessage: r.message,
            })),
            watchdog: {
              lastHeartbeatAt: null,
              heartbeatLagMs: null,
              stall: null,
              lastLongTaskMs: null,
              budgetsMs: { wildStep: 90_000, chat: 60_000 },
            },
            growth: {
              rows: { ledger: 0, telemetryRing: rows.length, chatLog: 0 },
              bytes: {
                projectFile: 0,
                logDirBytes: rtServer ? rtServer.logDirBytes(rtServer.resolveLogDir(CLI_PROJECT)) : 0,
                localStorageEstimate: null,
              },
              counts: {},
            },
            persistHealth,
            crashSnapshot: null,
          });
          respond({ ok: true, ...diagnosis }, 0);
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
  if (proj.error) respond({ ok: false, error: proj.error, code: "RT_E_VALIDATION" }, 1);
  return proj.value;
}

const USAGE = {
  description: "File-based headless RapidTool driver (no browser).",
  commands: {
    create: "create --brief <text> [--name <text>] [--advisory] [--out <file.json>]   # default out: <slug>.json in the CWD (intermediate control file); --advisory: advisory DoD gates even when DEEPSEEK_API_KEY is set (keyed runs default enforceDod ON)",
    run: "run --project <file.json> [--live]            # advance one phase",
    gate: "gate --project <file.json> [--autopilot] [--live]  # advance until parked",
    approve: "approve --project <file.json> [--force]",
    reject: "reject --project <file.json> --note <text>",
    retry: "retry --project <file.json>                  # unlock a rejected/blocked phase",
    ingest: "ingest --project <file.json> --report <json|@file.json|->  # @file or '-' = stdin",
    packet: "packet --project <file.json> [--out <file.md>] [--knowledge <store.json>]  # --knowledge seeds the Ranked-memory section with cross-project accepted lesson rows (tier-1, advisory)",
    export: "export --project <file.json> [--out <file.json>]",
    emit: "emit --project <file.json> [--out <dir>] [--check] [--run]   # write the runnable scaffold; default out: <home>/RapidTool Software/<slug>/ (--out overrides); --check adds per-file compile verdicts; --run adds the TreeRunOutcome (compile + tests + entry smoke), exit 1 when the tree is not ok",
    fixtures: "fixtures --project <file.json> (--draft | --approve --ids id1,id2 | --approve-all)  # draft brief-derived acceptance fixtures (always pending) OR human-approve selected/all ids — never auto-approves",
    "tree-run": "tree-run --dir <dir> [--project <file.json>]  # fixes/149 P0-1 emit→edit→re-emit oracle: compile-check treeRun over an EXISTING emitted dir — read-only, never re-emits over the dir (an edited file is never clobbered); green → 0; red → 1 with the first not-ok tail + RT_E_TREE_RUN_FAILED; --project adds the hash-checked dirDirty divergence report (read-only, never persisted)",
    repair: "repair --dir <dir> --project <file.json> [--budget N]  # fixes/149 P0-1 continuation seam: re-import the EDITED tree files from the dir into project.generatedTree (path→content, hash-checked per file; refused paths are warnings, never silent drops) + run the journey's bounded repair cycle AGAINST the dir (treeRun → red tail → one bounded synthesis repair call with deps.treeFailure → apply repaired files in place → re-import → treeRun again); green → tested-equivalent mint + honest P6 gate + converged (0); budget exhausted → honest failed (1, RT_E_REPAIR_FAILED); the dir is the artifact, the project JSON the ledger (persisted after every completed run); default budget 3",
    summary: "summary --project <file.json>",
    vault: "vault --project <file.json> [--out <dir>]   # one .md per note + _index.md MOC (default <home>/RapidTool Software/<slug>/vault)",
    search: "search --project <file.json> --query <text> [--limit <n>]  # token-overlap vault search",
    crew: "crew --project <file.json> [--max-steps <n>]  # advisory multi-agent crew (needs DEEPSEEK_API_KEY)",
    verify: "verify --project <file.json> [--apply]      # machine verify-fix on generatedSource; --apply persists the verdict",
    check: "check --dir <path>                          # per-file compile verdicts over an emitted dir (.js via node --check; .ts via the typescript devDep)",
    design: "design --project <file.json> [--html <out.html>]  # design tokens (+ standalone HTML when --html)",
    diagram: "diagram --project <file.json> --kind phases|architecture|flow [--out <file.svg>]  # SVG diagram",
    artifacts: "artifacts --project <file.json>           # index of project artifacts (id/phase/kind/title/bytes)",
    doctor: "doctor [--tree <dir>]                       # capability pre-flight (llm/research/runner/node/factory)",
    harvest: "harvest --project <file.json>               # bounded live-source harvest (repos/license/snippets) for the brief",
    swarm: "swarm --project <file.json>                  # deterministic advisory swarm critique of the current phase",
    prompt: "prompt --project <file.json> [--policies a,b]  # hyper-prompt expansion (needs DEEPSEEK_API_KEY)",
    bench: "bench --project <file.json>                  # synthetic estimates: tokens/time/complexity/failure points",
    mine: "mine --dir <path> [--limit N]                # bounded structural codebase map + convention map",
    knowledge: "knowledge --store <file.json> (--save <json>|--find <query>) [--limit N]  # cross-project pattern store",
    lesson: "lesson (--list --project <file.json> [--brief <text>] [--limit N] | --propose --brief <text> [--title <t>] [--kind fix|pattern|note] [--tags a,b] [--project <name>] | --accept --project <file.json> --out <knowledge.json> [--actor <name>] [--limit N] | --supersede --knowledge-file <knowledge.json> --id <K...> [--evidence <text>|--reason <text>] [--by human|machine] | --refute --knowledge-file <knowledge.json> --id <K...> [--evidence <text>])  # lesson family: list rows read-only (fusionRank vs --brief, else score-desc) / propose = bounded flash DRAFT, never writes (keyless drafts labeled 'draft (keyless)') / accept = THE human-gated cross-project write, actor recorded per row, idempotent per actor / supersede + refute = store telemetry (append-only rows + counters, never deletes)",
    wild: "wild --project <file.json> [--start|--pause|--resume|--stop] [--steps N]  # wild-mode macro-run; --start enables + begins a run",
    chat: "chat --project <file.json> --ask <text> [--history <json-array>]  # grounded copilot turn; slash tools /status /gate /packet /fixtures /ls /read /help work keyless; free-text needs DEEPSEEK_API_KEY",
    deepen: "deepen --project <file.json> [--phase N]    # re-run live research over a completed research phase (0/7/11)",
  },
};

main();
