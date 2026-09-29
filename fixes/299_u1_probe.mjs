// U1 scratch probe (NOT committed; deleted before the lane closes): emit the
// four kind trees via the pure scaffold emitter and probe the exact spawn
// shapes the entry-runs evaluation will use.
// HEADER NOTE fixes/301 · X4 (2026-09-28): the "deleted before the lane closes"
// intent missed — it was committed accidentally at 4af061a. Kept under fixes/ as
// U1's entry-runs evidence. Run from the repo root:
//   node --experimental-strip-types fixes/299_u1_probe.mjs
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import * as scaffold from "../src/lib/scaffold.ts";

const base = join(tmpdir(), "u1-probe");
rmSync(base, { recursive: true, force: true });

const cases = [
  { slug: "invoice-csv-cli", proj: { name: "invoice-csv-cli", kind: "tool", brief: "convert invoice csv to json" } },
  { slug: "date-rrule-library", proj: { name: "date-rrule-library", brief: "an rrule date library sdk" } },
  { slug: "order-webhook-service", proj: { name: "order-webhook-service", brief: "an order webhook service api" } },
  { slug: "arcade-breakout", proj: { name: "arcade-breakout", kind: "game", brief: "a breakout arcade game" } },
];

const dirs = {};
for (const c of cases) {
  const dir = join(base, c.slug);
  const res = scaffold.scaffoldProject(c.proj);
  if (!res.ok) {
    console.log(`${c.slug}: EMIT FAIL ${res.error}`);
    continue;
  }
  for (const f of res.files) {
    const p = join(dir, f.path);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, f.body, "utf8");
  }
  dirs[c.slug] = dir;
  console.log(`\n=== ${c.slug} (kind emitted) files: ${res.files.map((f) => f.path).join(", ")}`);
  try {
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    console.log("  pkg:", JSON.stringify({ main: pkg.main, bin: pkg.bin, exports: pkg.exports, scripts: pkg.scripts }));
  } catch {
    console.log("  pkg: unreadable");
  }
}

const run = (args, cwd, opts = {}) =>
  spawnSync(process.execPath, args, { cwd, encoding: "utf8", timeout: 30000, ...opts });
const desc = (r) => `status=${r.status} signal=${r.signal ?? "-"} err=${r.error ? r.error.code || r.error.message : "-"} out=${JSON.stringify((r.stdout || "").slice(0, 120))} errText=${JSON.stringify((r.stderr || "").slice(0, 160))}`;

console.log("\n--- cli: bin launcher --help / bare ---");
if (dirs["invoice-csv-cli"]) {
  const cwd = dirs["invoice-csv-cli"];
  console.log("help :", desc(run(["bin/invoice-csv-cli.mjs", "--help"], cwd)));
  console.log("bare :", desc(run(["bin/invoice-csv-cli.mjs"], cwd)));
}

console.log("\n--- library: import via -e loader (with flag / without) ---");
if (dirs["date-rrule-library"]) {
  const cwd = dirs["date-rrule-library"];
  const abs = join(cwd, "src/main.ts");
  const loader =
    'const { pathToFileURL } = await import("node:url");' +
    'const m = await import(pathToFileURL(process.argv[1]).href);' +
    'console.log("import ok; exports: " + Object.keys(m).join(","));';
  console.log("imp+flag :", desc(run(["--experimental-strip-types", "--input-type=module", "-e", loader, abs], cwd)));
  console.log("imp bare :", desc(run(["--input-type=module", "-e", loader, abs], cwd)));
  console.log("exec .ts :", desc(run(["--experimental-strip-types", "src/main.ts"], cwd)));
}

console.log("\n--- service: bare exec (refusal) + PORT env ---");
if (dirs["order-webhook-service"]) {
  const cwd = dirs["order-webhook-service"];
  console.log("bare     :", desc(run(["--experimental-strip-types", "src/main.ts"], cwd)));
  console.log("PORT=9999:", desc(run(["--experimental-strip-types", "src/main.ts"], cwd, { env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, PORT: "9999" } })));
  const loader2 =
    'const { pathToFileURL } = await import("node:url");' +
    'const m = await import(pathToFileURL(process.argv[1]).href);' +
    'console.log("port: " + m.resolvePort({ PORT: "9999" }) + "," + m.resolvePort({ PORT: "nope" }));';
  console.log("import   :", desc(run(["--experimental-strip-types", "--input-type=module", "-e", loader2, join(cwd, "src/main.ts")], cwd)));
}

console.log("\n--- timeout shape (spawnSync ETIMEDOUT) ---");
console.log("hang:", desc(run(["-e", "setTimeout(() => {}, 60000)"], process.cwd(), { timeout: 2000 })));

console.log("\n--- game: index.html present ---");
if (dirs["arcade-breakout"]) {
  console.log("html:", readFileSync(join(dirs["arcade-breakout"], "index.html"), "utf8").slice(0, 90).replace(/\n/g, " "));
}

console.log("\n--- cli src/main.ts head ---");
if (dirs["invoice-csv-cli"]) {
  console.log(readFileSync(join(dirs["invoice-csv-cli"], "src/main.ts"), "utf8").split("\n").slice(0, 12).join("\n"));
}
console.log("\nbase:", base);
