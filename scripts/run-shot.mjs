#!/usr/bin/env node
// ---------------------------------------------------------------------------
// run-shot.mjs — capture a REAL screenshot of an emitted product tree.
//
// The factory proves a delivery with an `emit --run` verdict (the tree parses,
// its specs pass, the entry smoke runs) — but a verdict is not a picture. This
// tool closes that gap: point it at an emitted tree directory, it serves that
// directory statically over loopback, loads the tree's `index.html` in headless
// Chromium, and writes real PNGs of what the browser rendered.
//
// fixes/350 F2: an emitted Vite/TSX tree is SOURCE (`index.html` →
// `/src/main.tsx`), so a purely static serve renders an empty root and there
// was no picture to take. When the static serve renders nothing AND the build
// step is enabled, the tool makes a BOUNDED `vite build` of a TEMP COPY of the
// tree (the input tree is never mutated) using the repo's shared toolchain —
// the same symlink seam `compile-check.server.ts` uses (`linkSharedToolchain`)
// — then serves the produced `dist/` and captures that. `--no-build` keeps the
// static-only path.
//
// HONESTY (the whole point): a shot is a claim that "this is what the product
// looks like". So the tool FAILS to a coded, non-fabricating skip whenever it
// cannot make that claim:
//   · no `index.html` at the tree root      → skipped RT_SHOT_NO_ENTRY
//   · Playwright / its chromium is absent   → skipped RT_SHOT_NO_BROWSER
//   · the page rendered no visible content  → skipped RT_SHOT_EMPTY_RENDER
//   · no buildable tree toolchain           → skipped RT_SHOT_BUILD_UNAVAILABLE
//   · the bounded `vite build` failed/timed → skipped RT_SHOT_BUILD_FAILED /
//                                              RT_SHOT_BUILD_TIMEOUT
//   · the build wrote no `dist/index.html`  → skipped RT_SHOT_NO_DIST
//     (a blank 1280x800 PNG is written by NO branch: nothing is captured
//      before the render is confirmed, so a blank image is never kept)
// It never renders a placeholder and never passes one off as a screenshot.
//
// Usage:
//   node scripts/run-shot.mjs --dir <emitted-dir> [--out <dir>]
//                             [--viewport <WxH>] [--wait <ms>] [--no-build]
//
//   --dir <dir>       the emitted tree (must contain index.html to capture).
//   --out <dir>       output directory (default: <dir>/../screenshots, i.e.
//                     beside the run artifact).
//   --viewport <WxH>  browser viewport (default 1280x800).
//   --wait <ms>       settle time after load before the capture (default 1500).
//   --no-build        never build; serve the tree statically as-emitted and
//                     keep the honest RT_SHOT_EMPTY_RENDER skip when it does
//                     not render.
//
// stdout: exactly ONE JSON object `{ ok, dir, entry, shots[], skipped, reason }`.
// Exit: 0 captured · 3 honest skip · 1 capture error · 2 usage error.
// ---------------------------------------------------------------------------
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { isMainModule } from "./with-app-env.mjs";

const DEFAULT_VIEWPORT = { width: 1280, height: 800 };
const DEFAULT_WAIT_MS = 1500;
const DEFAULT_TIMEOUT_MS = 30_000;
const ENTRY_FILE = "index.html";
const MAX_VIEWPORT = 10_000;
const MAX_WAIT_MS = 120_000;
/** scripts/ → the RapidTool repo root (for the shared toolchain junction). */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/** Vite's default build output, relative to the built tree root. */
const BUILD_DIR = "dist";
const DEFAULT_BUILD_TIMEOUT_MS = 90_000;
const MAX_BUILD_TIMEOUT_MS = 600_000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".cjs": "text/javascript; charset=utf-8",
  ".ts": "text/javascript; charset=utf-8",
  ".tsx": "text/javascript; charset=utf-8",
  ".jsx": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
};

/** MIME type for a served path, defaulting to a binary stream. */
export function mimeFor(filePath) {
  return MIME[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

/**
 * Parse and validate argv. Returns `{ dir, out, viewport, waitMs, build }` or
 * `{ error }` — a malformed argument is a usage error (exit 2), never a silent
 * default that screenshots or writes somewhere the caller did not name.
 * @param {string[]} argv
 * @returns {{ dir: string, out: string | null, viewport: { width: number, height: number }, waitMs: number, build: boolean, error?: undefined } | { error: string }}
 */
export function parseShotArgs(argv) {
  const known = new Set(["--dir", "--out", "--viewport", "--wait"]);
  const booleanFlags = new Set(["--no-build"]);
  const values = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (booleanFlags.has(token)) {
      if (values[token] !== undefined) return { error: `${token} given more than once` };
      values[token] = true;
      continue;
    }
    if (!known.has(token)) return { error: `unknown argument: ${token}` };
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      return { error: `${token} needs a value (a bare flag would silently use the CWD)` };
    }
    if (values[token] !== undefined) return { error: `${token} given more than once` };
    values[token] = value;
    i += 1;
  }
  if (values["--dir"] === undefined) return { error: "--dir <emitted-tree-dir> is required" };

  const viewport = { ...DEFAULT_VIEWPORT };
  if (values["--viewport"] !== undefined) {
    const m = /^(\d+)x(\d+)$/.exec(values["--viewport"]);
    if (!m)
      return { error: `--viewport expects <WxH> (e.g. 1280x800), got ${values["--viewport"]}` };
    const width = Number(m[1]);
    const height = Number(m[2]);
    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width < 1 ||
      height < 1 ||
      width > MAX_VIEWPORT ||
      height > MAX_VIEWPORT
    ) {
      return { error: `--viewport out of range (1..${MAX_VIEWPORT}): ${values["--viewport"]}` };
    }
    Object.assign(viewport, { width, height });
  }

  let waitMs = DEFAULT_WAIT_MS;
  if (values["--wait"] !== undefined) {
    if (!/^\d+$/.test(values["--wait"])) {
      return {
        error: `--wait expects milliseconds (a non-negative integer), got ${values["--wait"]}`,
      };
    }
    waitMs = Number(values["--wait"]);
    if (waitMs > MAX_WAIT_MS)
      return { error: `--wait exceeds ${MAX_WAIT_MS}ms: ${values["--wait"]}` };
  }

  return {
    dir: resolve(values["--dir"]),
    out: values["--out"] !== undefined ? resolve(values["--out"]) : null,
    viewport: { width: viewport.width, height: viewport.height },
    waitMs,
    build: values["--no-build"] !== true,
  };
}

/** The tree's browser entry, or null — only a root `index.html` is an entry. */
export function resolveEntry(dir) {
  const entry = join(dir, ENTRY_FILE);
  try {
    return statSync(entry).isFile() ? ENTRY_FILE : null;
  } catch {
    return null;
  }
}

/** Output directory: an explicit --out, else `<dir>/../screenshots` (beside the run). */
export function defaultOutDir(dir, out) {
  return out ?? resolve(dir, "..", "screenshots");
}

/**
 * Serve `root` statically over a loopback ephemeral port. Path traversal is
 * refused (the resolved target must stay inside `root`). Async: resolves to
 * `{ url, close() }` once the socket is bound.
 */
export function startStaticServer(root) {
  const server = createServer((req, res) => {
    try {
      const raw = decodeURIComponent((req.url ?? "/").split("?")[0].split("#")[0]);
      let rel = raw.replace(/^[/\\]+/, "");
      if (rel === "") rel = ENTRY_FILE;
      const target = resolve(root, rel);
      if (target !== root && !target.startsWith(root.endsWith(sep) ? root : root + sep)) {
        res.writeHead(403, { "content-type": "text/plain" });
        res.end("forbidden");
        return;
      }
      let file = target;
      try {
        if (statSync(file).isDirectory()) file = join(file, ENTRY_FILE);
      } catch {
        // not a directory — fall through to the file read below
      }
      let body;
      try {
        body = readFileSync(file);
      } catch {
        res.writeHead(404, { "content-type": "text/plain" });
        res.end("not found");
        return;
      }
      res.writeHead(200, { "content-type": mimeFor(file), "cache-control": "no-store" });
      res.end(body);
    } catch {
      res.writeHead(500, { "content-type": "text/plain" });
      res.end("server error");
    }
  });
  return new Promise((resolveP, rejectP) => {
    server.once("error", rejectP);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolveP({
        url: `http://127.0.0.1:${port}/`,
        close: () => new Promise((done) => server.close(() => done(undefined))),
      });
    });
  });
}

/**
 * Whether the page produced anything a human would see. An unresolved entry
 * module leaves an empty `#root`, so this is what separates a real shot from a
 * blank frame — text, a sized canvas, or loaded media must be present.
 */
export function renderedProbe() {
  const body = document.body;
  if (!body) return { rendered: false, textLen: 0, canvas: 0, media: 0 };
  const textLen = (body.innerText ?? "").trim().length;
  const sized = (sel) =>
    [...document.querySelectorAll(sel)].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1;
    }).length;
  const canvas = sized("canvas");
  const media = sized("img, video, svg, picture, iframe");
  return { rendered: textLen > 0 || canvas > 0 || media > 0, textLen, canvas, media };
}

/** PNG file signature — proves the bytes on disk are a real image. */
export function isPng(buffer) {
  return (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  );
}

/**
 * The RapidTool repo's own installed toolchain root (the `node_modules` beside
 * `scripts/`), or null when there is none. This is the same shared root
 * `compile-check.server.ts` junctions into an emitted tree that ships no deps:
 * only the toolchain + modules the repo already has are reachable, so a build
 * is genuinely offline and no dependency is fabricated.
 */
export function repoSharedToolchainRoot() {
  try {
    const deps = join(REPO_ROOT, "node_modules");
    return existsSync(join(deps, ".bin")) ? deps : null;
  } catch {
    return null;
  }
}

/**
 * BOUNDED production build of an emitted Vite-source tree, in a TEMP COPY.
 *
 * The input tree is NEVER mutated: the copy excludes `node_modules`/`.git` and
 * gains a JUNCTION to the tree's own (or the repo's shared) toolchain root, so
 * `vite build` resolves a real, offline toolchain. Returns
 * `{ ok:true, dist, copy, cleanup }` when `dist/index.html` exists, else an
 * honest `{ ok:false, reason, detail }` — this function never fabricates an
 * output.
 * @param {string} treeDir
 * @param {{ toolchainRoot?: string, tmpRoot?: string, timeoutMs?: number, spawn?: typeof spawnSync }} [opts]
 */
export function buildTreeToDist(treeDir, opts = {}) {
  const timeoutMs =
    typeof opts.timeoutMs === "number" && opts.timeoutMs > 0
      ? Math.min(opts.timeoutMs, MAX_BUILD_TIMEOUT_MS)
      : DEFAULT_BUILD_TIMEOUT_MS;
  const treeDeps = join(treeDir, "node_modules");
  const linkSource =
    existsSync(treeDeps) ? treeDeps : opts.toolchainRoot ?? repoSharedToolchainRoot();
  const viteBin = linkSource ? join(linkSource, "vite", "bin", "vite.js") : null;
  if (!linkSource || !viteBin || !existsSync(viteBin)) {
    return {
      ok: false,
      reason: "RT_SHOT_BUILD_UNAVAILABLE",
      detail:
        "no vite toolchain reachable for the tree (neither the tree's node_modules nor the repo shared root ships vite)",
    };
  }

  let copy;
  try {
    copy = mkdtempSync(join(opts.tmpRoot ?? tmpdir(), "rt-shot-"));
  } catch (err) {
    return { ok: false, reason: "RT_SHOT_BUILD_FAILED", detail: `temp copy failed: ${String(err?.message || err)}` };
  }
  const cleanup = () => {
    try {
      rmSync(copy, { recursive: true, force: true });
    } catch {
      // best-effort: a leftover temp dir never fails the capture
    }
  };
  try {
    const skip = new Set([join(treeDir, "node_modules"), join(treeDir, ".git")]);
    cpSync(treeDir, copy, { recursive: true, filter: (src) => !skip.has(src) });
    if (!existsSync(join(copy, "node_modules"))) {
      try {
        symlinkSync(linkSource, join(copy, "node_modules"), "junction");
      } catch (err) {
        cleanup();
        return {
          ok: false,
          reason: "RT_SHOT_BUILD_UNAVAILABLE",
          detail: `could not link the shared toolchain into the build copy: ${String(err?.message || err)}`,
        };
      }
    }
    const spawn = opts.spawn ?? spawnSync;
    const res = spawn(process.execPath, [viteBin, "build"], {
      cwd: copy,
      encoding: "utf8",
      timeout: timeoutMs,
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
      killSignal: "SIGKILL",
      // Offline posture: vite build makes no network calls, and these keep npm
      // from trying an update check. No dependency is ever fetched.
      env: { ...process.env, CI: "1", NO_UPDATE_NOTIFIER: "1", npm_config_offline: "true" },
    });
    if (res.error && /** @type {{ code?: string }} */ (res.error).code === "ETIMEDOUT") {
      cleanup();
      return { ok: false, reason: "RT_SHOT_BUILD_TIMEOUT", detail: `vite build exceeded ${timeoutMs}ms` };
    }
    if (res.error) {
      cleanup();
      return { ok: false, reason: "RT_SHOT_BUILD_FAILED", detail: String(res.error.message || res.error) };
    }
    if (res.status !== 0) {
      const out = [res.stdout, res.stderr].filter((s) => typeof s === "string" && s.trim()).join("\n");
      cleanup();
      return {
        ok: false,
        reason: "RT_SHOT_BUILD_FAILED",
        detail: out.trim().split("\n").slice(-8).join("\n").slice(0, 1200) || `vite build exited ${res.status}`,
      };
    }
    const dist = join(copy, BUILD_DIR);
    if (!existsSync(join(dist, ENTRY_FILE))) {
      cleanup();
      return { ok: false, reason: "RT_SHOT_NO_DIST", detail: `vite build produced no ${BUILD_DIR}/${ENTRY_FILE}` };
    }
    return { ok: true, dist, copy, cleanup, command: `vite build (${viteBin})` };
  } catch (err) {
    cleanup();
    return { ok: false, reason: "RT_SHOT_BUILD_FAILED", detail: String(err?.message || err) };
  }
}

function done(payload, exitCode) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
  process.exitCode = exitCode;
}

/**
 * Serve `root` statically, load its entry in the browser, probe what rendered
 * and — ONLY when the page is confirmed non-empty — write the PNGs. Each call
 * is self-contained (its own server + page, both closed) so the tree as
 * emitted and the built `dist/` are probed by the exact same rule.
 * @returns {Promise<{ rendered: { rendered: boolean, textLen: number, canvas: number, media: number }, shots: Array<{ name: string, path: string, fullPage: boolean, bytes: number, png: boolean }>, consoleErrors: string[] }>}
 */
async function captureRoot(browser, root, args, outDir, timeoutMs) {
  const consoleErrors = [];
  const server = await startStaticServer(root);
  try {
    const page = await browser.newPage({ viewport: args.viewport });
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(String(err?.message || err)));
    await page.goto(server.url, { waitUntil: "load", timeout: timeoutMs });
    await page.waitForTimeout(args.waitMs);

    const rendered = await page.evaluate(renderedProbe);
    const shots = [];
    if (rendered.rendered) {
      mkdirSync(outDir, { recursive: true });
      /** @type {Array<[string, boolean]>} */
      const shotSpecs = [
        ["shot.png", false],
        ["shot-full.png", true],
      ];
      for (const [name, fullPage] of shotSpecs) {
        const path = join(outDir, name);
        await page.screenshot({ path, fullPage });
        shots.push({
          name,
          path,
          fullPage,
          bytes: statSync(path).size,
          png: isPng(readFileSync(path)),
        });
      }
    }
    await page.close();
    return { rendered, shots, consoleErrors };
  } finally {
    await server.close();
  }
}

async function capture(args) {
  const base = { ok: false, dir: args.dir, entry: null, shots: [], skipped: false, reason: null };
  if (!args.dir || !existsSync(args.dir) || !statSync(args.dir).isDirectory()) {
    return done({ ...base, skipped: true, reason: "RT_SHOT_NO_DIR" }, 3);
  }
  const entry = resolveEntry(args.dir);
  if (!entry) {
    return done({ ...base, skipped: true, reason: "RT_SHOT_NO_ENTRY" }, 3);
  }

  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch (err) {
    return done(
      {
        ...base,
        entry,
        skipped: true,
        reason: "RT_SHOT_NO_BROWSER",
        error: String(err?.message || err),
      },
      3,
    );
  }
  let executable = null;
  try {
    executable = chromium.executablePath();
  } catch {
    executable = null;
  }
  if (!executable || !existsSync(executable)) {
    return done(
      {
        ...base,
        entry,
        skipped: true,
        reason: "RT_SHOT_NO_BROWSER",
        error: "chromium is not installed for Playwright (run: npx playwright install chromium)",
      },
      3,
    );
  }

  const outDir = defaultOutDir(args.dir, args.out);
  const timeoutMs = Number(process.env.RUN_SHOT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  const buildTimeoutMs = Number(process.env.RUN_SHOT_BUILD_TIMEOUT_MS) || DEFAULT_BUILD_TIMEOUT_MS;
  const consoleErrors = [];
  let browser = null;
  let build = null;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });

    // 1) The tree AS EMITTED. A Vite-source tree (index.html → /src/main.tsx)
    //    renders an empty root here — which is exactly what the build step fixes.
    let servedDir = args.dir;
    let attempt = await captureRoot(browser, args.dir, args, outDir, timeoutMs);
    consoleErrors.push(...attempt.consoleErrors);
    let buildInfo = null;

    // 2) BOUNDED build fallback: build a temp copy of the tree with the shared
    //    toolchain, then serve the produced dist/ and capture THAT. The input
    //    tree is never mutated; a failed build keeps the honest coded skip.
    if (!attempt.rendered.rendered && args.build) {
      build = buildTreeToDist(args.dir, { timeoutMs: buildTimeoutMs });
      buildInfo = {
        attempted: true,
        ok: build.ok === true,
        reason: build.ok ? null : build.reason,
        command: build.command ?? null,
        detail: build.detail ?? null,
        dist: build.ok ? build.dist : null,
      };
      if (!build.ok) {
        return done(
          {
            ...base,
            entry,
            skipped: true,
            reason: build.reason,
            viewport: args.viewport,
            consoleErrors,
            build: buildInfo,
            note: `the static serve rendered nothing and the bounded build could not produce ${BUILD_DIR}/${ENTRY_FILE}; no image written`,
          },
          3,
        );
      }
      servedDir = build.dist;
      attempt = await captureRoot(browser, servedDir, args, outDir, timeoutMs);
      consoleErrors.push(...attempt.consoleErrors);
    }

    if (!attempt.rendered.rendered) {
      return done(
        {
          ...base,
          entry,
          skipped: true,
          reason: "RT_SHOT_EMPTY_RENDER",
          viewport: args.viewport,
          consoleErrors,
          ...(buildInfo ? { build: buildInfo } : {}),
          note: buildInfo
            ? "the built tree's entry rendered no visible content; no image written"
            : "the tree's entry rendered no visible content when served statically; no image written",
        },
        3,
      );
    }

    const shots = attempt.shots;
    if (shots.some((s) => !s.png)) {
      return done(
        {
          ...base,
          entry,
          ok: false,
          reason: "RT_SHOT_NOT_PNG",
          shots,
          error: "capture did not produce PNG bytes",
        },
        1,
      );
    }
    return done(
      {
        ok: true,
        dir: args.dir,
        servedDir,
        entry,
        shots,
        skipped: false,
        reason: null,
        out: outDir,
        viewport: args.viewport,
        waitMs: args.waitMs,
        rendered: attempt.rendered,
        consoleErrors,
        ...(buildInfo ? { build: buildInfo } : {}),
      },
      0,
    );
  } catch (err) {
    return done(
      {
        ...base,
        entry,
        reason: "RT_SHOT_CAPTURE_FAILED",
        error: String(err?.message || err),
        consoleErrors,
      },
      1,
    );
  } finally {
    try {
      await browser?.close();
    } catch {
      // best-effort teardown
    }
    build?.cleanup?.();
  }
}

if (isMainModule(import.meta.url)) {
  const args = parseShotArgs(process.argv.slice(2));
  if (args.error) {
    done(
      {
        ok: false,
        dir: null,
        entry: null,
        shots: [],
        skipped: false,
        code: "RT_SHOT_USAGE",
        error: args.error,
      },
      2,
    );
  } else {
    await capture(args);
  }
}
