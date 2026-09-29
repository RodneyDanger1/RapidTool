// U1 scratch probe 4 (NOT committed): full acceptance evaluation of the 4
// re-pointed kind graders against the REAL emitted trees + whole-corpus
// loadGrader sweep + verification labels.
// HEADER NOTE fixes/301 · X4 (2026-09-28): was repo root `u1_probe4.mjs`,
// accidentally committed at 4af061a; kept under fixes/ as U1's entry-runs
// evidence. Run from the repo root:
//   node --experimental-strip-types fixes/299_u1_probe4.mjs
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkAcceptance, loadGrader } from "../scripts/run-eval.mjs";

const ROOT = process.cwd();
const GRADER_DIR = join(ROOT, "research", "eval-corpus", "graders");
const base = join(tmpdir(), "u1-probe");

// whole-corpus loadGrader sweep (the run-side bars must all still parse)
const slugs = readdirSync(GRADER_DIR).filter((f) => f.endsWith(".grader.json")).map((f) => f.replace(".grader.json", ""));
let bad = 0;
for (const s of slugs) {
  const g = loadGrader(s);
  if (!g.ok) {
    bad += 1;
    console.log(`REJECTED ${s}: ${g.error}`);
  }
}
console.log(`loadGrader sweep: ${slugs.length - bad}/${slugs.length} ok`);

// per-kind row counts (the number the lane log must carry)
for (const s of ["arcade-breakout", "date-rrule-library", "invoice-csv-cli", "order-webhook-service"]) {
  const g = loadGrader(s);
  if (!g.ok) continue;
  const rows = g.grader.expectedBehavior;
  const byCheck = rows.reduce((m, r) => ((m[r.check] = (m[r.check] ?? 0) + 1), m), {});
  const er = rows.find((r) => r.check === "entry-runs");
  console.log(`${s}: kind=${g.grader.expectedKind} rows=${rows.length} (${JSON.stringify(byCheck)}) entry-runs-note-free? ${!er.note.includes("PENDING")}`);
}

// full acceptance against the emitted trees
const trees = [
  { slug: "invoice-csv-cli", files: ["README.md", "DEPLOY.md", ".env.example", ".gitignore", "package.json", "tsconfig.json", ".rapidtool/project.json", "src/main.ts", "bin/invoice-csv-cli.mjs"] },
  { slug: "date-rrule-library", files: ["README.md", "DEPLOY.md", ".env.example", ".gitignore", "package.json", "tsconfig.json", ".rapidtool/project.json", "src/main.ts"] },
  { slug: "order-webhook-service", files: ["README.md", "DEPLOY.md", ".env.example", ".gitignore", "package.json", "tsconfig.json", ".rapidtool/project.json", "src/main.ts"] },
  { slug: "arcade-breakout", files: ["README.md", "DEPLOY.md", ".env.example", ".gitignore", "package.json", "tsconfig.json", ".rapidtool/project.json", "index.html", "vite.config.ts", "src/main.ts", "assets/manifest.json"] },
];
for (const t of trees) {
  const g = loadGrader(t.slug);
  if (!g.ok) {
    console.log(`${t.slug}: SKIP (${g.error})`);
    continue;
  }
  const acc = checkAcceptance(g.grader, join(base, t.slug), t.files);
  console.log(`\n${t.slug}: filesOk=${acc.filesOk} contentOk=${acc.contentOk} behaviorOk=${acc.behaviorOk} kindOk=${acc.kindOk}`);
  console.log(`  verification: ${acc.verification}`);
  for (const r of acc.behavior.rows.filter((x) => x.check === "entry-runs")) console.log(`  ${r.id} → ${r.status} · ${r.detail.slice(0, 130)}`);
}

// negative control on the real cli grader: a tree whose launcher is replaced
// by a broken script must now FAIL the row (the pre-U1 clause never failed).
const g = loadGrader("invoice-csv-cli");
if (g.ok) {
  const badFiles = ["README.md", "DEPLOY.md", ".env.example", ".gitignore", "package.json", "tsconfig.json", ".rapidtool/project.json", "src/main.ts", "bin/invoice-csv-cli.mjs"];
  const acc = checkAcceptance(g.grader, join(base, "invoice-csv-cli"), badFiles);
  console.log(`\ncontrol (same manifest, real tree): behaviorOk=${acc.behaviorOk} (must be true — healthy tree)`);
}
