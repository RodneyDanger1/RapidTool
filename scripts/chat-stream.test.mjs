import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

/**
 * W19-L3 (T5.1 · wave_plans/W19/lanes-and-watchdogs.md LANE 3; fixes/252_lane3_t51.md)
 * — the scripts-leg NDJSON STREAM transport test.
 *
 * Transport spike first (fixes/252): incremental NDJSON over a byte sink needs
 * ZERO dependencies (S1b: real node:http + fetch body reader, arrival gaps
 * tracking the server's writes; S3: real child stdout read incrementally), while
 * the createServerFn transport is request/response and NOT invocable outside the
 * Start runtime (S2: "No Start context found in AsyncLocalStorage"). So this leg
 * is a REAL child process — `node --experimental-strip-types` — driving the REAL
 * `chatStreamNdjson` from src/lib/chat.ts with the REAL one-shot turn
 * (`chatOnceServer`, the module the server fn delegates to) and writing its
 * frames to its OWN stdout; this file's test mode reads that pipe incrementally
 * and asserts on the frames that really arrived.
 *
 * Self-spawn (`--chat-stream-child <case>`) keeps the fixture inside this one
 * scripts file — the scripts leg runs WITHOUT --experimental-strip-types and
 * cannot import the .ts module itself (house rule, see
 * scripts/rapidtool-cli-edit.test.mjs:44-45). What is asserted is real emitted
 * bytes, never a hand-built stream: reverting `chatStreamNdjson` breaks the
 * child's import and every test here goes RED.
 *
 * Child cases:
 *   reply    — keyed env + mocked model transport (the repo's keyless test
 *              device, chat.test.ts:232): chunks + one ok terminal, exit 0;
 *   keyless  — no key: NO chunks, ONE coded terminal (RT_E_LLM_NOT_CONFIGURED),
 *              exit 1;
 *   abort    — pre-aborted signal: ONE coded terminal (RT_E_ABORTED), exit 1.
 */

const SELF = fileURLToPath(import.meta.url);
const CHILD_FLAG = "--chat-stream-child";

/** The fixture reply — the SAME const drives the child's canned model answer and
 *  the parent's byte-exact reassembly assertion (both modes share this module). */
const REPLY =
  "Paragraph one of the reply.\n\nParagraph two, still here.\n\nParagraph three closes it.";

// ---------------------------------------------------------------------------
// CHILD MODE — real leg over this process's own stdout.
// ---------------------------------------------------------------------------
if (process.argv.includes(CHILD_FLAG)) {
  const caseName = process.argv[process.argv.indexOf(CHILD_FLAG) + 1] ?? "";
  const exitCode = await runChild(caseName);
  // Drain stdout BEFORE exiting so no frame is truncated on the pipe.
  await new Promise((resolve) => process.stdout.write("", resolve));
  process.exit(exitCode);
}

async function runChild(caseName) {
  // Dynamic imports under --experimental-strip-types: the REAL modules.
  const { chatStreamNdjson } = await import(new URL("../src/lib/chat.ts", import.meta.url).href);
  const { chatOnceServer } = await import(new URL("../src/lib/chat.server.ts", import.meta.url).href);
  const { emptyProject } = await import(new URL("../src/lib/engine.ts", import.meta.url).href);

  const project = emptyProject({ name: "Streamleg", brief: "NDJSON transport fixture." });
  const write = (line) => {
    process.stdout.write(line);
  };
  const turn = (p, text, history) => chatOnceServer(p, text, history);

  if (caseName === "reply") {
    process.env.DEEPSEEK_API_KEY = "sk-child-fixture";
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          model: "deepseek-v4-flash",
          choices: [{ message: { role: "assistant", content: REPLY } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    const summary = await chatStreamNdjson({ project, userText: "stream the fixture", turn, write });
    return summary.ok ? 0 : 1;
  }
  if (caseName === "keyless") {
    delete process.env.DEEPSEEK_API_KEY;
    const summary = await chatStreamNdjson({ project, userText: "stream the fixture", turn, write });
    return summary.ok ? 0 : 1;
  }
  if (caseName === "abort") {
    const ac = new AbortController();
    ac.abort();
    const summary = await chatStreamNdjson({
      project,
      userText: "stream the fixture",
      turn,
      write,
      signal: ac.signal,
    });
    return summary.ok ? 0 : 1;
  }
  throw new Error(`unknown --chat-stream-child case: ${caseName}`);
}

// ---------------------------------------------------------------------------
// TEST MODE — spawn the child, read its stdout incrementally, assert ordering.
// ---------------------------------------------------------------------------

/** Run one child case; frames are recorded in ARRIVAL ORDER off the real pipe. */
function runStreamChild(caseName) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.DEEPSEEK_API_KEY; // children opt in explicitly (case `reply`)
    delete env.DEEPSEEK_MODEL_MAIN;
    const child = spawn(
      process.execPath,
      ["--experimental-strip-types", SELF, CHILD_FLAG, caseName],
      { env, stdio: ["ignore", "pipe", "pipe"] },
    );
    const raw = [];
    const frames = [];
    let buf = "";
    let malformed = null;
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (line.trim() === "") continue;
        raw.push(line);
        try {
          frames.push(JSON.parse(line));
        } catch {
          malformed = line;
          frames.push(null);
        }
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      resolve({ code, signal, raw, frames, malformed, tail: buf, stderr });
    });
  });
}

test("real child stdout: ≥2 ordered chunk frames then ONE ok terminal envelope", async () => {
  const run = await runStreamChild("reply");
  assert.equal(run.malformed, null, `every stdout line must be JSON NDJSON: ${run.malformed}`);
  assert.equal(run.tail, "", "no truncated trailing line");
  assert.equal(run.code, 0, `child exit must be 0 on an ok leg.\nstderr: ${run.stderr}`);
  const terminal = run.frames[run.frames.length - 1];
  const chunks = run.frames.slice(0, -1);
  assert.ok(chunks.length >= 2, `expected ≥2 ordered chunks, got ${chunks.length}`);
  assert.ok(
    chunks.every((f) => f && typeof f.chunk === "string" && Number.isInteger(f.seq)),
    "every non-terminal frame is a chunk frame",
  );
  assert.deepEqual(
    chunks.map((f) => f.seq),
    chunks.map((_, i) => i + 1),
    "chunks arrive strictly ordered 1..N (arrival order === seq order)",
  );
  assert.equal(
    chunks.map((f) => f.chunk).join(""),
    REPLY,
    "the chunk bytes reassemble byte-exactly into the reply",
  );
  assert.equal(run.frames.filter((f) => f && f.done === true).length, 1, "exactly ONE terminal frame");
  assert.ok(terminal && terminal.done === true && terminal.ok === true, "the terminal is the ok envelope");
  assert.equal(terminal.reply, REPLY);
  assert.match(terminal.provenance, /^Grounded in build context v\d+/);
});

test("real child stdout: keyless turn closes with a coded terminal error, no chunks", async () => {
  const run = await runStreamChild("keyless");
  assert.equal(run.malformed, null, `every stdout line must be JSON NDJSON: ${run.malformed}`);
  assert.equal(run.tail, "", "no truncated trailing line");
  assert.equal(run.code, 1, `a coded terminal error must exit 1.\nstderr: ${run.stderr}`);
  assert.equal(run.frames.length, 1, "exactly one frame — a keyless turn streams NO chunks");
  const frame = run.frames[0];
  assert.ok(frame && frame.done === true && frame.ok === false, "the frame is the failure terminal");
  assert.equal(frame.reason, "not-configured");
  assert.equal(frame.code, "RT_E_LLM_NOT_CONFIGURED");
  assert.equal(typeof frame.error, "string");
});

test("real child stdout: an aborted leg closes with the coded RT_E_ABORTED terminal", async () => {
  const run = await runStreamChild("abort");
  assert.equal(run.malformed, null, `every stdout line must be JSON NDJSON: ${run.malformed}`);
  assert.equal(run.tail, "", "no truncated trailing line");
  assert.equal(run.code, 1, `an aborted leg must exit 1.\nstderr: ${run.stderr}`);
  assert.equal(run.frames.length, 1, "exactly one frame — an aborted leg streams NO chunks");
  const frame = run.frames[0];
  assert.ok(frame && frame.done === true && frame.ok === false, "the frame is the failure terminal");
  assert.equal(frame.code, "RT_E_ABORTED");
});
