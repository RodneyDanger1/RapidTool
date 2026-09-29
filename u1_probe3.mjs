// U1 scratch probe 3 (NOT committed): functional check of the new
// checkExpectedBehavior entry-runs evaluation against the real emitted trees
// from probe 1/2 + synthetic broken/HANGING trees.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkExpectedBehavior, parseGrader } from "./scripts/run-eval.mjs";

const base = join(tmpdir(), "u1-probe");
const show = (label, grader, dir, files) => {
  const res = checkExpectedBehavior(grader, dir, files);
  console.log(`\n[${label}] declared=${res.declared} passed=${res.passed} failed=${res.failed} uiShell=${res.uiShell} pending=${res.pending} ok=${res.ok} complete=${res.complete}`);
  for (const r of res.rows) console.log(`   ${r.id} → ${r.status} · ${r.detail}`);
};

// real emitted trees (probe 1) — manifests === file lists
const cliFiles = ["README.md", "DEPLOY.md", ".env.example", ".gitignore", "package.json", "tsconfig.json", ".rapidtool/project.json", "src/main.ts", "bin/invoice-csv-cli.mjs"];
const libFiles = ["README.md", "DEPLOY.md", ".env.example", ".gitignore", "package.json", "tsconfig.json", ".rapidtool/project.json", "src/main.ts"];
const svcFiles = libFiles;
const gameFiles = ["README.md", "DEPLOY.md", ".env.example", ".gitignore", "package.json", "tsconfig.json", ".rapidtool/project.json", "index.html", "vite.config.ts", "src/main.ts", "assets/manifest.json"];

show("cli --help (expect pass)", { expectedBehavior: [{ id: "cli-help-runs", check: "entry-runs", entry: "bin/invoice-csv-cli.mjs", args: ["--help"], expectExit: 0, expectStdout: "usage:" }] }, join(base, "invoice-csv-cli"), cliFiles);
show("library import (expect pass)", { expectedBehavior: [{ id: "library-import-runs", check: "entry-runs", entry: "src/main.ts", mode: "import" }] }, join(base, "date-rrule-library"), libFiles);
show("service refusal (expect pass)", { expectedBehavior: [{ id: "service-port-wiring", check: "entry-runs", entry: "src/main.ts", expectExit: 1, expectStderr: "RT_E_VALIDATION" }] }, join(base, "order-webhook-service"), svcFiles);
show("game ui-shell (expect ui-shell)", { expectedBehavior: [{ id: "game-entry-runs", check: "entry-runs", uiShell: true }] }, join(base, "arcade-breakout"), gameFiles);
show("game ui-shell premise FALSE (expect fail)", { expectedBehavior: [{ id: "game-entry-runs", check: "entry-runs", uiShell: true }] }, join(base, "date-rrule-library"), libFiles);

// synthetic trees: a broken entry, a hanging entry, a key-leak probe
const synth = mkdtempSync(join(tmpdir(), "u1-synth-"));
mkdirSync(join(synth, "src"), { recursive: true });
writeFileSync(join(synth, "src", "broken.mjs"), "process.exit(3);\n");
writeFileSync(join(synth, "src", "hang.mjs"), "setTimeout(() => {}, 60000);\n");
writeFileSync(join(synth, "src", "env.mjs"), "console.log('KEY=' + (process.env.DEEPSEEK_API_KEY ? 'LEAKED' : 'absent') + ',OPTS=' + (process.env.NODE_OPTIONS ? 'present' : 'absent'));\n");
const synthFiles = ["src/broken.mjs", "src/hang.mjs", "src/env.mjs"];
show("broken exit (expect fail)", { expectedBehavior: [{ id: "b", check: "entry-runs", entry: "src/broken.mjs" }] }, synth, synthFiles);
show("hanging (expect timeout fail)", { expectedBehavior: [{ id: "h", check: "entry-runs", entry: "src/hang.mjs", timeoutMs: 900 }] }, synth, synthFiles);
show("missing entry (expect fail)", { expectedBehavior: [{ id: "m", check: "entry-runs", entry: "src/nope.mjs" }] }, synth, synthFiles);
show("env minimal (expect pass + absent KEY)", { expectedBehavior: [{ id: "e", check: "entry-runs", entry: "src/env.mjs", expectStdout: "KEY=absent,OPTS=absent" }] }, synth, synthFiles);

// parse guards
const base1 = { slug: "s", acceptanceBar: "bar", requiredIdentifiers: [], requiredCapabilities: [] };
const pg = (row) => parseGrader(JSON.stringify({ ...base1, expectedBehavior: [row] }), "s");
console.log("\nparse: no entry →", pg({ id: "x", check: "entry-runs" }).ok, "|", pg({ id: "x", check: "entry-runs" }).error);
console.log("parse: uiShell ok →", pg({ id: "x", check: "entry-runs", uiShell: true }).ok);
console.log("parse: uiShell+entry →", pg({ id: "x", check: "entry-runs", uiShell: true, entry: "a" }).ok);
console.log("parse: bad mode →", pg({ id: "x", check: "entry-runs", entry: "a", mode: "nope" }).ok);
console.log("parse: args non-array →", pg({ id: "x", check: "entry-runs", entry: "a", args: "zz" }).ok);
console.log("parse: import+args →", pg({ id: "x", check: "entry-runs", entry: "a", mode: "import", args: ["y"] }).ok);
console.log("parse: bad expectExit →", pg({ id: "x", check: "entry-runs", entry: "a", expectExit: 1.5 }).ok);
console.log("parse: valid roundtrip →", JSON.stringify(pg({ id: "x", check: "entry-runs", entry: "./bin/a.mjs", args: ["--help"], expectExit: 0, expectStdout: "u", timeoutMs: 5000 }).grader.expectedBehavior));

// real graders: loadGrader through the module + label
import { loadGrader, checkAcceptance } from "./scripts/run-eval.mjs";
for (const slug of ["invoice-csv-cli", "date-rrule-library", "order-webhook-service", "arcade-breakout"]) {
  const g = loadGrader(slug);
  console.log(`grader ${slug}: ok=${g.ok}${g.ok ? "" : " ERR=" + g.error}`);
  if (g.ok) console.log("   rows:", JSON.stringify(g.grader.expectedBehavior.filter((r) => r.check === "entry-runs")));
}
