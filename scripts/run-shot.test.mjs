// ---------------------------------------------------------------------------
// run-shot.test.mjs — fixes/349 L2 (the product-screenshot tool).
//
// Two legs:
//
//  A. PURE — argument validation, the static server and the entry/MIME
//     helpers, asserted in-process (no browser needed).
//
//  B. BEHAVIORAL — spawn the REAL script and read its one-JSON verdict:
//       · a missing dir               → honest skip RT_SHOT_NO_DIR (exit 3)
//       · an existing dir, no entry   → honest skip RT_SHOT_NO_ENTRY (exit 3)
//       · a renderable static tree    → ok:true + real PNGs (browser present)
//       · an unrenderable entry       → skip RT_SHOT_EMPTY_RENDER, ZERO files
//         written (the honesty rule: a blank frame is never kept as a shot)
//
// Browser availability is detected honestly: when Playwright's chromium is not
// installed the capture legs assert the coded RT_SHOT_NO_BROWSER skip instead,
// so the suite passes with or without a browser download. Run:
//   node --test scripts/run-shot.test.mjs
// ---------------------------------------------------------------------------
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  defaultOutDir,
  mimeFor,
  parseShotArgs,
  resolveEntry,
  startStaticServer,
} from "./run-shot.mjs";

const SCRIPT_PATH = fileURLToPath(new URL("./run-shot.mjs", import.meta.url));

/** Whether a real chromium is installed for Playwright (no download triggered). */
async function detectBrowser() {
  try {
    const { chromium } = await import("playwright");
    const executable = chromium.executablePath();
    return Boolean(executable && existsSync(executable));
  } catch {
    return false;
  }
}

const HAS_BROWSER = await detectBrowser();

function runShot(args) {
  return spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
  });
}

function jsonOf(res) {
  try {
    return JSON.parse(res.stdout);
  } catch {
    assert.fail(
      `run-shot did not print one JSON object (exit ${res.status}).\n${res.stdout}\n${res.stderr}`,
    );
  }
}

/** parseShotArgs, asserting the success shape (so callers can read fields). */
function parseOk(argv) {
  const r = parseShotArgs(argv);
  if (r.error !== undefined) assert.fail(`expected a valid parse, got: ${r.error}`);
  return /** @type {{ dir: string, out: string | null, viewport: { width: number, height: number }, waitMs: number }} */ (
    r
  );
}

function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), "run-shot-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// A · PURE contract.
// ---------------------------------------------------------------------------
test("parseShotArgs — validates --dir/--out/--viewport/--wait, never silently defaults a bad value", () => {
  const ok = parseOk(["--dir", ".", "--out", "shots", "--viewport", "800x600", "--wait", "250"]);
  assert.equal(ok.viewport.width, 800);
  assert.equal(ok.viewport.height, 600);
  assert.equal(ok.waitMs, 250);
  assert.ok(ok.dir.length > 0);

  const defaults = parseOk(["--dir", "."]);
  assert.deepEqual(defaults.viewport, { width: 1280, height: 800 });
  assert.equal(defaults.waitMs, 1500);

  // A second parse must not inherit the first's mutated viewport.
  assert.deepEqual(parseOk(["--dir", "."]).viewport, { width: 1280, height: 800 });

  assert.match(String(parseShotArgs([]).error), /--dir .* required/);
  assert.match(String(parseShotArgs(["--dir"]).error), /--dir needs a value/);
  assert.match(String(parseShotArgs(["--dir", ".", "--nope"]).error), /unknown argument/);
  assert.match(
    String(parseShotArgs(["--dir", ".", "--viewport", "1280"]).error),
    /--viewport expects/,
  );
  assert.match(String(parseShotArgs(["--dir", ".", "--viewport", "0x10"]).error), /out of range/);
  assert.match(String(parseShotArgs(["--dir", ".", "--wait", "-5"]).error), /--wait expects/);
  assert.match(String(parseShotArgs(["--dir", ".", "--wait", "abc"]).error), /--wait expects/);
  assert.match(String(parseShotArgs(["--dir", ".", "--dir", "."]).error), /more than once/);
});

test("resolveEntry / defaultOutDir / mimeFor — entry resolution and static-server types", () => {
  withTempDir((dir) => {
    assert.equal(resolveEntry(dir), null);
    assert.equal(defaultOutDir(dir, null), resolve(dir, "..", "screenshots"));
    assert.equal(defaultOutDir(dir, join(dir, "custom")), join(dir, "custom"));
    writeFileSync(join(dir, "index.html"), "<!doctype html><html><body>hi</body></html>", "utf8");
    assert.equal(resolveEntry(dir), "index.html");
  });
  assert.match(mimeFor("/x/index.html"), /text\/html/);
  assert.match(mimeFor("/x/app.js"), /javascript/);
  assert.match(mimeFor("/x/styles.css"), /text\/css/);
  assert.equal(mimeFor("/x/unknown.bin"), "application/octet-stream");
});

test("startStaticServer — serves the tree over loopback and refuses traversal", async () => {
  const dir = mkdtempSync(join(tmpdir(), "run-shot-srv-"));
  const server = await startStaticServer(dir);
  try {
    writeFileSync(join(dir, "index.html"), "<!doctype html><title>served</title>", "utf8");
    writeFileSync(join(dir, "data.json"), '{"a":1}', "utf8");
    assert.match(server.url, /^http:\/\/127\.0\.0\.1:\d+\/$/);

    const root = await fetch(server.url);
    assert.equal(root.status, 200);
    assert.match(await root.text(), /served/);
    assert.match(root.headers.get("content-type") ?? "", /text\/html/);

    const json = await fetch(`${server.url}data.json`);
    assert.equal(json.status, 200);
    assert.match(json.headers.get("content-type") ?? "", /application\/json/);

    const missing = await fetch(`${server.url}nope.js`);
    assert.equal(missing.status, 404);

    const escaped = await fetch(`${server.url}..%2f..%2fpackage.json`);
    assert.notEqual(escaped.status, 200, "path traversal must never serve outside the tree");
  } finally {
    await server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// B · BEHAVIORAL — the real script's one-JSON verdict.
// ---------------------------------------------------------------------------
test("a missing --dir is an honest coded skip, not an error", () => {
  const res = runShot(["--dir", join(tmpdir(), "run-shot-definitely-missing-12345")]);
  assert.equal(res.status, 3);
  const j = jsonOf(res);
  assert.equal(j.ok, false);
  assert.equal(j.skipped, true);
  assert.equal(j.reason, "RT_SHOT_NO_DIR");
  assert.deepEqual(j.shots, []);
});

test("an existing tree with no index.html is an honest coded skip", () => {
  withTempDir((dir) => {
    const res = runShot(["--dir", dir]);
    assert.equal(res.status, 3);
    const j = jsonOf(res);
    assert.equal(j.skipped, true);
    assert.equal(j.reason, "RT_SHOT_NO_ENTRY");
    assert.equal(j.entry, null);
    assert.deepEqual(j.shots, []);
  });
});

test("a malformed argument is a usage error (exit 2)", () => {
  const res = runShot(["--dir", ".", "--viewport", "wat"]);
  assert.equal(res.status, 2);
  const j = jsonOf(res);
  assert.equal(j.ok, false);
  assert.equal(j.code, "RT_SHOT_USAGE");
  assert.match(String(j.error), /viewport/);
});

test("a renderable static tree yields real PNGs — or the honest no-browser skip", () => {
  withTempDir((dir) => {
    writeFileSync(
      join(dir, "index.html"),
      "<!doctype html><html><head><title>Fixture</title></head><body><h1>Hello product</h1><p>real text</p></body></html>",
      "utf8",
    );
    const out = join(dir, "shots");
    const res = runShot(["--dir", dir, "--out", out]);

    if (!HAS_BROWSER) {
      assert.equal(res.status, 3, `expected a no-browser skip.\n${res.stdout}\n${res.stderr}`);
      const j = jsonOf(res);
      assert.equal(j.skipped, true);
      assert.equal(j.reason, "RT_SHOT_NO_BROWSER");
      assert.deepEqual(j.shots, []);
      return;
    }

    assert.equal(res.status, 0, `expected a capture.\n${res.stdout}\n${res.stderr}`);
    const j = jsonOf(res);
    assert.equal(j.ok, true);
    assert.equal(j.skipped, false);
    assert.equal(j.entry, "index.html");
    assert.equal(j.rendered.rendered, true);
    assert.ok(j.shots.length >= 1);
    for (const shot of j.shots) {
      assert.equal(shot.png, true, "the bytes must be a real PNG");
      assert.ok(existsSync(shot.path), `shot missing on disk: ${shot.path}`);
      assert.ok(statSync(shot.path).size > 0, "a shot is never a zero-byte file");
    }
  });
});

test("an entry that renders nothing is an honest skip and writes NO blank image", () => {
  withTempDir((dir) => {
    // A module entry the browser cannot execute (JSX in a .tsx), exactly the
    // shape of a Vite source tree served statically — it renders an empty root.
    writeFileSync(
      join(dir, "index.html"),
      '<!doctype html><html><head><title>Blank</title></head><body><div id="root"></div><script type="module" src="/app.tsx"></script></body></html>',
      "utf8",
    );
    writeFileSync(
      join(dir, "app.tsx"),
      "const el = <div>never mounts</div>; export default el;\n",
      "utf8",
    );
    const out = join(dir, "shots");
    const res = runShot(["--dir", dir, "--out", out, "--wait", "800"]);

    if (!HAS_BROWSER) {
      assert.equal(res.status, 3);
      assert.equal(jsonOf(res).reason, "RT_SHOT_NO_BROWSER");
      return;
    }
    assert.equal(res.status, 3, `expected an empty-render skip.\n${res.stdout}\n${res.stderr}`);
    const j = jsonOf(res);
    assert.equal(j.ok, false);
    assert.equal(j.skipped, true);
    assert.equal(j.reason, "RT_SHOT_EMPTY_RENDER");
    assert.deepEqual(j.shots, []);
    const written = existsSync(out) ? readdirSync(out).filter((f) => f.endsWith(".png")) : [];
    assert.deepEqual(written, [], "a blank render must never leave a PNG behind");
  });
});

test("the real emitted tree under ../testruns is captured or honestly skipped", () => {
  const tree = fileURLToPath(
    new URL("../../testruns/campaign2/office-scheduler/emitted", import.meta.url),
  );
  if (!existsSync(tree)) {
    // The testruns junction is optional scaffolding; absence is not a failure.
    return;
  }
  const res = runShot(["--dir", tree, "--out", join(tmpdir(), "run-shot-emitted")]);
  const j = jsonOf(res);
  assert.equal(j.dir, resolve(tree), "the verdict names the tree it read");
  if (!HAS_BROWSER) {
    assert.equal(j.reason, "RT_SHOT_NO_BROWSER");
  }
  // Whatever the outcome, it must be one of the honest, coded shapes.
  assert.ok(
    j.ok === true ||
      ["RT_SHOT_NO_ENTRY", "RT_SHOT_NO_BROWSER", "RT_SHOT_EMPTY_RENDER"].includes(j.reason),
    `unexpected verdict: ${res.stdout}`,
  );
  if (j.ok === true) {
    for (const shot of j.shots) assert.equal(shot.png, true);
  } else {
    assert.deepEqual(j.shots, [], "a skip never lists shots");
  }
});
