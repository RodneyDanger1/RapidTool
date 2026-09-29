// ---------------------------------------------------------------------------
// probe-k9-kinds.mjs — W40 · K9 · the 4 kinds' RUNNABLE emission, empirically.
//
// Run:  node --experimental-strip-types probe-k9-kinds.mjs
//
// For each corpus-facing kind (game / cli-tool / library / service):
//   1. a FULL keyless headless run of a kind-typical brief (no keys, no network)
//   2. emitProject() into a temp dir (the REAL emit path run-eval uses)
//   3. per-kind shape checks on package.json + on-disk files
//   4. RUNNABLE checks with real child processes:
//        cli-tool  — `node bin/<slug>.mjs --help` (exit 0 + usage), and the
//                    bare entry (exit 1 + RT_E_VALIDATION refusal)
//        library   — import the entry, assert the declared surface
//        service   — import resolvePort + the bare entry refusal
//        game      — shape only (vite build needs network install — honest note)
//   5. treeRun() — the emitted tree's OWN compile/spec/entry/project legs
//      (the evidence the run-eval `entry-runs` row can cite).
// One JSON line per case + a final ALL-PASS/FAIL marker. Throwaway probe.
// ---------------------------------------------------------------------------
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { ALL_PHASES, runHeadless, seedProject } from "./src/lib/testing/fixtures.ts";
import { emitProject } from "./src/lib/headless.ts";
import { projectKindOf } from "./src/lib/scaffold.ts";
import { treeRun } from "./src/lib/compile-check.server.ts";

const NODE = process.execPath;
const CASES = [
  {
    label: "game",
    seed: {
      kind: "game",
      name: "Arcade Breakout",
      brief:
        "A browser arcade game: a paddle, a ball and rows of bricks; three levels of increasing speed; score and high-score; keyboard controls; pause and resume; win and lose screens; canvas only.",
    },
  },
  {
    label: "cli-tool",
    seed: {
      kind: "tool",
      name: "Invoice CSV CLI",
      brief:
        "A command-line tool that reads a CSV invoice export and converts it to a JSON summary: --in and --out flags, per-vendor totals, monthly rollups, non-zero exit on malformed rows.",
    },
  },
  {
    label: "library",
    seed: {
      name: "RRULE Kit",
      brief:
        "A TypeScript library (npm package) of recurrence-rule helpers: build and read RFC 5545 RRULE strings, compute the next and previous occurrence, expand a series; pure functions, no I/O.",
    },
  },
  {
    label: "service",
    seed: {
      name: "Order Webhook Service",
      brief:
        "A webhook worker service: receives order events on an HTTP endpoint, validates payloads, queues retries with backoff, exposes a health check; reads PORT from the environment.",
    },
  },
];

function walk(dir, rel = "") {
  const out = [];
  for (const name of readdirSync(join(dir, rel))) {
    const p = rel ? `${rel}/${name}` : name;
    if (statSync(join(dir, p)).isDirectory()) out.push(...walk(dir, p));
    else out.push(p);
  }
  return out;
}

const results = [];
for (const c of CASES) {
  const checks = [];
  const note = (ok, id, detail) => checks.push({ ok, id, detail });
  try {
    const project = runHeadless(seedProject(c.seed), ALL_PHASES);
    const kind = projectKindOf(project);
    note(kind === c.label, "kind-classified", `projectKindOf=${kind} (want ${c.label})`);

    const dir = join(mkdtempSync(join(tmpdir(), "k9-")), `${c.label}-emit`);
    const res = await emitProject(project, dir, { redTree: "probe" });
    note(res.ok === true, "emit-ok", res.ok ? `files=${res.files.length}` : `error=${res.error}`);
    if (!res.ok) {
      results.push({ case: c.label, checks });
      continue;
    }
    const files = walk(dir).map((f) => f.replace(/\\/g, "/"));
    const has = (p) => files.some((f) => f === p || f.endsWith(`/${p}`));
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    const pkgTargets = (target) => {
      const v = pkg[target];
      if (typeof v === "string") return [v];
      if (Array.isArray(v)) return v.filter((x) => typeof x === "string");
      if (v && typeof v === "object") {
        const out = [];
        for (const x of Object.values(v)) {
          if (typeof x === "string") out.push(x);
          else if (x && typeof x === "object") for (const y of Object.values(x)) if (typeof y === "string") out.push(y);
        }
        return out;
      }
      return [];
    };
    const targetResolves = (target) =>
      pkgTargets(target).every((t) => {
        const rel = String(t).replace(/^\.\//, "").replace(/^\/+/, "");
        return has(rel);
      });

    if (c.label === "game") {
      note(has("index.html"), "file:index.html", "");
      note(has("src/main.ts"), "file:src/main.ts", "");
      note(has("vite.config.ts"), "file:vite.config.ts", "");
      note(has("assets/manifest.json"), "file:assets/manifest.json", "");
      note(pkg.main === "src/main.ts", "pkg.main", String(pkg.main));
      const html = readFileSync(join(dir, "index.html"), "utf8");
      note(html.includes("/src/main.ts"), "index.html entry ref", "");
      note(files.every((f) => !f.startsWith("src/main.tsx")), "no tsx entry for game", "");
    } else if (c.label === "cli-tool") {
      const bin = pkgTargets("bin");
      note(bin.length === 1, "pkg.bin declared", JSON.stringify(pkg.bin));
      note(bin.length > 0 && targetResolves("bin"), "pkg.bin target exists", bin.join(","));
      note(has("src/main.ts"), "file:src/main.ts", "");
      const help = spawnSync(NODE, [bin[0].replace(/^\.\//, ""), "--help"], { cwd: dir, encoding: "utf8" });
      note(help.status === 0 && /usage:/i.test(help.stdout), "bin --help runs", `exit=${help.status} out=${(help.stdout || "").trim().slice(0, 60)}`);
      const bare = spawnSync(NODE, ["--experimental-strip-types", "src/main.ts"], { cwd: dir, encoding: "utf8" });
      note(bare.status === 1 && /RT_E_VALIDATION/.test(bare.stderr), "bare entry refuses coded", `exit=${bare.status} err=${(bare.stderr || "").trim().slice(0, 70)}`);
      note(!has("index.html"), "no index.html for cli", "");
    } else if (c.label === "library") {
      note(pkgTargets("main").length === 1 && targetResolves("main"), "pkg.main target exists", JSON.stringify(pkg.main));
      note(targetResolves("exports"), "pkg.exports target exists", JSON.stringify(pkg.exports));
      note(Array.isArray(pkg.files) && pkg.files.includes("src"), "pkg.files", JSON.stringify(pkg.files));
      const tmpProbe = join(tmpdir(), `k9-lib-import-${Date.now()}.mjs`);
      writeFileSync(tmpProbe, `const m = await import(${JSON.stringify(pathToFileURL(join(dir, "src/main.ts")).href)});\nconsole.log(JSON.stringify({ entry: m.entry, hasMain: typeof m.main === "function" }));\n`);
      const imp = spawnSync(NODE, ["--experimental-strip-types", tmpProbe], { cwd: dir, encoding: "utf8" });
      let parsed = null;
      try { parsed = JSON.parse(imp.stdout.trim().split("\n").pop() || "null"); } catch { /* keep null */ }
      note(imp.status === 0 && parsed && parsed.entry && parsed.entry.name, "import runs nothing + surface", `exit=${imp.status} ${imp.stdout.trim().slice(0, 80)}${imp.stderr ? " ERR " + imp.stderr.trim().slice(0, 60) : ""}`);
    } else if (c.label === "service") {
      note(pkgTargets("main").length === 1 && targetResolves("main"), "pkg.main target exists", JSON.stringify(pkg.main));
      note(typeof pkg.scripts.start === "string", "scripts.start", String(pkg.scripts.start));
      note(has(".env.example") && readFileSync(join(dir, ".env.example"), "utf8").includes("PORT"), ".env.example PORT", "");
      const tmpProbe = join(tmpdir(), `k9-svc-import-${Date.now()}.mjs`);
      writeFileSync(tmpProbe, `const m = await import(${JSON.stringify(pathToFileURL(join(dir, "src/main.ts")).href)});\nconsole.log(JSON.stringify({ portDefault: m.resolvePort({}), portEnv: m.resolvePort({ PORT: "1234" }), bad: m.resolvePort({ PORT: "nope" }), hasMain: typeof m.main === "function" }));\n`);
      const imp = spawnSync(NODE, ["--experimental-strip-types", tmpProbe], { cwd: dir, encoding: "utf8" });
      let parsed = null;
      try { parsed = JSON.parse(imp.stdout.trim().split("\n").pop() || "null"); } catch { /* keep null */ }
      note(imp.status === 0 && parsed && parsed.portDefault === 8080 && parsed.portEnv === 1234 && parsed.bad === 8080 && parsed.hasMain, "PORT wiring + import", `exit=${imp.status} ${imp.stdout.trim().slice(0, 100)}`);
      const bare = spawnSync(NODE, ["--experimental-strip-types", "src/main.ts"], { cwd: dir, encoding: "utf8" });
      note(bare.status === 1 && /RT_E_VALIDATION/.test(bare.stderr), "bare entry refuses coded", `exit=${bare.status} err=${(bare.stderr || "").trim().slice(0, 70)}`);
    }

    // The emitted README's own Kind line (the `expectedKind` assertion's target).
    const readme = readFileSync(join(dir, "README.md"), "utf8");
    const kindLine = (readme.match(/\*\*Kind:\*\*\s*([a-z-]+)/) || [])[1] || null;
    note(kindLine === c.label, "readme-kind-line", `line=${kindLine}`);

    // The tree's own compile/spec/entry/project legs (run-eval's tree-run).
    const tr = await treeRun(dir, { timeoutMs: 120000 });
    const legs = {
      ok: tr.ok,
      compile: tr.compile ? tr.compile.ok : null,
      specs: (tr.tests || []).map((t) => `${t.file}:${t.run}`),
      entry: tr.run ? `${tr.run.kind}:${tr.run.run}` : null,
      project: tr.project ? tr.project.ok : null,
      error: tr.error ? String(tr.error).slice(0, 160) : null,
      note: tr.note ? String(tr.note).slice(0, 200) : null,
    };
    note(tr.ok === true, "treeRun-ok", JSON.stringify(legs));
    results.push({ case: c.label, dir, checks });
  } catch (err) {
    note(false, "probe-throw", err instanceof Error ? err.message : String(err));
    results.push({ case: c.label, checks });
  }
}

let allPass = true;
for (const r of results) {
  const fails = r.checks.filter((x) => !x.ok);
  if (fails.length) allPass = false;
  console.log(`--- ${r.case} ${fails.length ? "FAIL" : "PASS"} (${r.checks.length - fails.length}/${r.checks.length})`);
  for (const f of fails) console.log(`    x ${f.id}: ${f.detail}`);
  if (r.dir) console.log(`    dir: ${r.dir}`);
}
console.log(allPass ? "K9 KINDS PROBE: ALL PASS" : "K9 KINDS PROBE: FAIL");
process.exitCode = allPass ? 0 : 1;
